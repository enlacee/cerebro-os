<?php

namespace App\Http\Controllers;

use App\Models\CallRequest;
use App\Models\Conversation;
use App\Services\CallSlots;
use App\Services\Telegram;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
            'name' => ['required', 'string', 'max:80'],
            'whatsapp' => ['required', 'string', 'max:25'],
            'project' => ['required', 'string', 'max:300'],
            'slot' => ['required', 'string'],
            'timezone' => ['nullable', 'timezone:all'], // zona horaria del visitante (navegador)
            'website' => ['nullable', 'string'], // trampa para bots: un humano no la ve
        ]);

        // Bot detectado: respondemos "ok" sin guardar nada.
        if (filled($data['website'] ?? null)) {
            return response()->json(['message' => 'Listo ✅']);
        }

        $whatsapp = preg_replace('/\D/', '', $data['whatsapp']);
        if (strlen($whatsapp) < 8 || strlen($whatsapp) > 15) {
            throw ValidationException::withMessages(['whatsapp' => 'Revisa tu número de WhatsApp (con código de país).']);
        }

        $slot = $slots->find($data['slot']);
        if (! $slot) {
            throw ValidationException::withMessages(['slot' => 'Ese horario ya no está disponible. Elige otro.']);
        }

        $call = CallRequest::create([
            'conversation_id' => isset($data['session_id'])
                ? Conversation::firstWhere('session_id', $data['session_id'])?->id
                : null,
            'name' => $data['name'],
            'whatsapp' => $whatsapp,
            'project' => $data['project'],
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
            '📱 <a href="'.$call->whatsappLink().'">+'.$call->whatsapp.'</a>',
            '💬 '.e($call->project),
            '🕐 '.e($slot['label']),
            $local ? '🌍 Cliente en '.e($visitorTz).' — para él: '.e($local) : null,
        ])));

        $message = match (true) {
            $slot['now'] => "Listo ✅ Aníbal te llamará por WhatsApp en los próximos minutos al +{$whatsapp}.",
            $local !== null => "Listo ✅ Aníbal te llamará por WhatsApp: **{$local} (tu hora)** · en Perú: {$slot['label']}. Número: +{$whatsapp}.",
            default => "Listo ✅ Aníbal te llamará por WhatsApp: **{$slot['label']}** al +{$whatsapp}.",
        };

        return response()->json(['message' => $message], 201);
    }
}
