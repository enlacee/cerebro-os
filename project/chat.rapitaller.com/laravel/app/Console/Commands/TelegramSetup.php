<?php

namespace App\Console\Commands;

use App\Services\Telegram;
use Illuminate\Console\Command;

class TelegramSetup extends Command
{
    protected $signature = 'telegram:setup';

    protected $description = 'Muestra los chats que escribieron a tu bot (para TELEGRAM_CHAT_ID) y envía un mensaje de prueba a cada destinatario';

    public function handle(Telegram $telegram): int
    {
        if (blank(config('cerebro.telegram.token'))) {
            $this->error('Falta TELEGRAM_BOT_TOKEN en .env (créalo con @BotFather en Telegram).');

            return self::FAILURE;
        }

        $configured = $telegram->chatIds();

        // Quién le escribió al bot hace poco (Telegram guarda estos mensajes unas 24 h).
        $chats = collect($telegram->api('getUpdates')->json('result', []))
            ->map(fn (array $update) => $update['message']['chat'] ?? null)
            ->filter()
            ->unique('id');

        if ($chats->isNotEmpty()) {
            $this->line('Chats que le escribieron a tu bot:');
            foreach ($chats as $chat) {
                $name = trim(($chat['first_name'] ?? '').' '.($chat['last_name'] ?? '')) ?: ($chat['title'] ?? '?');
                $mark = in_array((string) $chat['id'], $configured, true) ? '✅ ya recibe avisos' : 'nuevo';
                $this->line(sprintf('  %s → %s  (%s)', $name, $chat['id'], $mark));
            }
            $this->newLine();
        }

        if ($configured === []) {
            $this->warn($chats->isEmpty()
                ? 'Escríbele cualquier mensaje a tu bot en Telegram (toca "Iniciar") y vuelve a correr este comando.'
                : 'Copia el número a TELEGRAM_CHAT_ID en .env y vuelve a correr este comando para probar.');

            return self::FAILURE;
        }

        $this->line('Para sumar otra cuenta: que toque "Iniciar" en el bot, corre este comando y agrega su número con coma:');
        $this->line('  TELEGRAM_CHAT_ID='.implode(',', $configured).',<nuevo>');
        $this->newLine();

        $failed = 0;
        foreach ($configured as $chatId) {
            $ok = $telegram->sendTo($chatId, '✅ <b>Cerebro OS conectado.</b> Aquí te llegarán las llamadas solicitadas desde el chat.');
            $ok ? $this->info("Prueba enviada a {$chatId} ✅") : $this->error("No llegó a {$chatId}: ¿esa cuenta tocó \"Iniciar\" en el bot?");
            $failed += $ok ? 0 : 1;
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
