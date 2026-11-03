<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class Telegram
{
    public function configured(): bool
    {
        return filled(config('cerebro.telegram.token')) && filled(config('cerebro.telegram.chat_id'));
    }

    /**
     * Envía un aviso (HTML) al dueño del negocio. Nunca rompe el flujo: si falla, lo registra en el log.
     */
    public function send(string $html): bool
    {
        if (! $this->configured()) {
            // Sin el texto: lleva nombre y teléfono del cliente, y los logs no deben guardar datos personales.
            Log::warning('Telegram no configurado; aviso no enviado');

            return false;
        }

        try {
            return $this->api('sendMessage', [
                'chat_id' => config('cerebro.telegram.chat_id'),
                'text' => $html,
                'parse_mode' => 'HTML',
                'disable_web_page_preview' => true,
            ])->successful();
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
