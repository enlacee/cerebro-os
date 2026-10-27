<?php

namespace App\Console\Commands;

use App\Services\Telegram;
use Illuminate\Console\Command;

class TelegramSetup extends Command
{
    protected $signature = 'telegram:setup';

    protected $description = 'Muestra tu TELEGRAM_CHAT_ID y envía un mensaje de prueba';

    public function handle(Telegram $telegram): int
    {
        if (blank(config('cerebro.telegram.token'))) {
            $this->error('Falta TELEGRAM_BOT_TOKEN en .env (créalo con @BotFather en Telegram).');

            return self::FAILURE;
        }

        if (blank(config('cerebro.telegram.chat_id'))) {
            $chats = collect($telegram->api('getUpdates')->json('result', []))
                ->map(fn (array $update) => $update['message']['chat'] ?? null)
                ->filter()
                ->unique('id');

            if ($chats->isEmpty()) {
                $this->warn('Escríbele cualquier mensaje a tu bot en Telegram y vuelve a correr este comando.');

                return self::FAILURE;
            }

            foreach ($chats as $chat) {
                $this->line(sprintf('  %s → TELEGRAM_CHAT_ID=%s', $chat['first_name'] ?? $chat['title'] ?? '?', $chat['id']));
            }
            $this->info('Copia tu TELEGRAM_CHAT_ID al .env y vuelve a correr este comando para probar.');

            return self::SUCCESS;
        }

        $ok = $telegram->send('✅ <b>Cerebro OS conectado.</b> Aquí te llegarán las llamadas solicitadas desde el chat.');
        $ok ? $this->info('Mensaje de prueba enviado ✅') : $this->error('No se pudo enviar. Revisa token y chat id.');

        return $ok ? self::SUCCESS : self::FAILURE;
    }
}
