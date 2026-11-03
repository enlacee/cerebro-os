<?php

namespace App\Console\Commands;

use App\Models\CallRequest;
use App\Services\Telegram;
use Illuminate\Console\Command;

class CallsRemind extends Command
{
    protected $signature = 'calls:remind';

    protected $description = 'Avisa por Telegram las llamadas pendientes de la franja que empieza en 5 minutos (o ya empezó)';

    public function handle(Telegram $telegram): int
    {
        $calls = CallRequest::where('status', 'pending')
            ->whereNull('reminded_at')
            ->where('slot_start', '<=', now()->addMinutes(5))
            ->where('slot_end', '>', now())
            ->orderBy('created_at')
            ->get();

        if ($calls->isEmpty()) {
            return self::SUCCESS;
        }

        $lines = $calls->map(fn (CallRequest $call) => sprintf(
            '• <b>%s</b> — <a href="%s">+%s</a>%s   💬 %s',
            e($call->name),
            $call->whatsappLink(),
            $call->whatsapp,
            "\n",
            e($call->project),
        ));

        $sent = $telegram->send("⏰ <b>Llamadas de esta franja ({$calls->count()})</b>\n\n".$lines->implode("\n\n"));

        // Solo se marcan si el aviso salió; si Telegram falla, se reintenta el siguiente minuto.
        if ($sent) {
            CallRequest::whereKey($calls->modelKeys())->update(['reminded_at' => now()]);
        }

        $this->info("{$calls->count()} llamadas en la franja · aviso ".($sent ? 'enviado' : 'NO enviado'));

        return self::SUCCESS;
    }
}
