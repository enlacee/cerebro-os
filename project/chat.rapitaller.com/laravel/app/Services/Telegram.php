<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class Telegram
{
    public function configured(): bool
    {
        return filled(config('cerebro.telegram.token')) && $this->chatIds() !== [];
    }

    /**
     * Destinatarios: TELEGRAM_CHAT_ID admite varios separados por coma (ej. tu cuenta y tu celular personal).
     *
     * @return list<string>
     */
    public function chatIds(): array
    {
        $ids = array_map('trim', explode(',', (string) config('cerebro.telegram.chat_id')));

        return array_values(array_unique(array_filter($ids, 'strlen')));
    }

    /**
     * Envía un aviso (HTML) a todos los destinatarios. Nunca rompe el flujo: si falla, lo registra en el log.
     * Devuelve true si llegó al menos a uno (así el recordatorio no se repite a quien ya lo recibió).
     */
    public function send(string $html): bool
    {
        if (! $this->configured()) {
            // Sin el texto: lleva nombre y teléfono del cliente, y los logs no deben guardar datos personales.
            Log::warning('Telegram no configurado; aviso no enviado');

            return false;
        }

        $sent = false;

        foreach ($this->chatIds() as $chatId) {
            $sent = $this->sendTo($chatId, $html) || $sent;
        }

        return $sent;
    }

    public function sendTo(string $chatId, string $html): bool
    {
        try {
            $ok = $this->api('sendMessage', [
                'chat_id' => $chatId,
                'text' => $html,
                'parse_mode' => 'HTML',
                'disable_web_page_preview' => true,
            ])->successful();

            if (! $ok) {
                // Lo típico: esa cuenta nunca tocó "Iniciar" en el bot. Sin el texto (lleva datos personales).
                Log::warning('Telegram no entregó el aviso', ['chat_id' => $chatId]);
            }

            return $ok;
        } catch (Throwable $e) {
            report($e);

            return false;
        }
    }

    public function api(string $method, array $params = []): \Illuminate\Http\Client\Response
    {
        return Http::timeout(10)->post(
            'https://api.telegram.org/bot'.config('cerebro.telegram.token').'/'.$method,
            $params,
        );
    }
}
