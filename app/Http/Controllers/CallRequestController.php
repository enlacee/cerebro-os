<?php

namespace App\Http\Controllers;

use App\Models\CallRequest;
use App\Models\Conversation;
use App\Services\CallSlots;
use App\Services\Telegram;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CallRequestController extends Controller
{
    public function slots(CallSlots $slots): JsonResponse
    {
        return response()->json([
            'timezone' => config('cerebro.timezone'),
            'slots' => $slots->next(),
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
            'slot_start' => $slot['start'],
            'slot_end' => $slot['end'],
        ]);

        $telegram->send(implode("\n", [
            '📞 <b>Nueva llamada solicitada</b>',
            '👤 '.e($call->name),
            '📱 <a href="'.$call->whatsappLink().'">+'.$call->whatsapp.'</a>',
            '💬 '.e($call->project),
            '🕐 '.e($slot['label']),
        ]));

        return response()->json([
            'message' => $slot['now']
                ? "Listo ✅ Aníbal te llamará por WhatsApp en los próximos minutos al +{$whatsapp}."
                : "Listo ✅ Aníbal te llamará por WhatsApp: **{$slot['label']}** al +{$whatsapp}.",
        ], 201);
    }
}
