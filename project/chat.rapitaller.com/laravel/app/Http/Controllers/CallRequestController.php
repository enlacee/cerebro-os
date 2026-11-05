<?php

namespace App\Http\Controllers;

use App\Models\CallRequest;
use App\Models\Conversation;
use App\Services\CallSlots;
use App\Services\Name;
use App\Services\Phone;
use App\Services\Telegram;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CallRequestController extends Controller
{
    public function slots(Request $request, CallSlots $slots): JsonResponse
    {
        return response()->json([
            'timezone' => config('cerebro.timezone'),
            'timezone_label' => config('cerebro.calls.timezone_label'),
            'slots' => $slots->next(count: max(1, (int) $request->query('count', config('cerebro.calls.slots_shown')))),
        ])->header('Cache-Control', 'no-cache');
    }

    public function store(Request $request, CallSlots $slots, Telegram $telegram): JsonResponse
    {
        $data = $request->validate([
            'session_id' => ['nullable', 'uuid'],
            'name' => ['required', 'string', 'min:2', 'max:80', 'regex:/\p{L}/u'],
            'country_code' => ['nullable', 'string', 'max:5'], // "+51"; sin él, va dentro de whatsapp
            'whatsapp' => ['required', 'string', 'max:25'],
            'project' => ['required', 'string', 'min:3', 'max:300'],
            'slot' => ['required', 'string'],
            'timezone' => ['nullable', 'timezone:all'], // zona horaria del visitante (navegador)
            'website' => ['nullable', 'string'], // trampa para bots: un humano no la ve
        ], [
            'name.required' => 'Escribe tu nombre.',
            'name.min' => 'Escribe tu nombre.',
            'name.regex' => 'Escribe tu nombre.',
            'whatsapp.required' => 'Escribe tu número de WhatsApp.',
            'project.required' => 'Cuéntame en pocas palabras de qué quieres hablar.',
            'project.min' => 'Cuéntame en pocas palabras de qué quieres hablar.',
            'slot.required' => 'Elige un horario.',
        ]);

        // Bot detectado: respondemos "ok" sin guardar nada.
        if (filled($data['website'] ?? null)) {
            return response()->json(['message' => 'Listo ✅']);
        }

        $phone = filled($data['country_code'] ?? null)
            ? Phone::parse($data['country_code'], $data['whatsapp'])
            : Phone::parseFull($data['whatsapp']);
        if (is_string($phone)) {
            throw ValidationException::withMessages(['whatsapp' => $phone]);
        }
        $whatsapp = $phone['digits'];

        $slot = $slots->find($data['slot']);
        if (! $slot) {
            throw ValidationException::withMessages(['slot' => 'Ese horario ya no está disponible. Elige otro.']);
        }

        $call = CallRequest::create([
            'conversation_id' => isset($data['session_id'])
                ? Conversation::firstWhere('session_id', $data['session_id'])?->id
                : null,
            'name' => Name::format($data['name']),
            'whatsapp' => $whatsapp,
            'project' => Str::ucfirst(trim($data['project'])),
            'timezone' => $data['timezone'] ?? null,
            'slot_start' => $slot['start'],
            'slot_end' => $slot['end'],
        ]);

        // Hora del cliente, solo si es distinta a la del negocio (ej. Madrid o México).
        $start = CarbonImmutable::parse($slot['start']);
        $visitorTz = $call->timezone;
        $local = $visitorTz && ! $slots->sameTime($visitorTz, $start)
            ? $slots->label($start, CarbonImmutable::parse($slot['end']), CarbonImmutable::now(), $visitorTz)
            : null;

        $telegram->send(implode("\n", array_filter([
            '📞 <b>Nueva llamada solicitada</b>',
            '👤 '.e($call->name),
            '📱 <a href="'.$call->whatsappLink().'">'.$phone['pretty'].'</a>',
            '💬 '.e($call->project),
            '🕐 '.e($slot['label']),
            $local ? '🌍 Cliente en '.e($visitorTz).' — para él: '.e($local) : null,
        ])));

        $owner = config('cerebro.owner_name');
        $message = match (true) {
            $slot['now'] => "Listo ✅ {$owner} te llamará por WhatsApp en los próximos minutos al {$phone['pretty']}.",
            $local !== null => "Listo ✅ {$owner} te llamará por WhatsApp: **{$local} (tu hora)** · {$slot['label']}. Número: {$phone['pretty']}.",
            default => "Listo ✅ {$owner} te llamará por WhatsApp: **{$slot['label']}** al {$phone['pretty']}.",
        };

        return response()->json(['message' => $message], 201);
    }
}
