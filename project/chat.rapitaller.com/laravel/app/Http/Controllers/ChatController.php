<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use App\Services\Knowledge;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Prism\Prism\Facades\Prism;
use Prism\Prism\Streaming\Events\ErrorEvent;
use Prism\Prism\Streaming\Events\TextDeltaEvent;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class ChatController extends Controller
{
    /**
     * Recibe un mensaje del widget y responde en streaming (SSE).
     */
    public function __invoke(Request $request, Knowledge $knowledge): StreamedResponse
    {
        $data = $request->validate([
            'session_id' => ['required', 'uuid'],
            'message' => ['required', 'string', 'max:'.config('cerebro.chat.max_message_length')],
        ]);

        $conversation = Conversation::firstOrCreate(['session_id' => $data['session_id']], [
            'ip' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
            'page_url' => Str::limit((string) $request->headers->get('referer'), 250, ''),
        ]);

        $conversation->messages()->create(['role' => 'user', 'content' => $data['message']]);

        // Últimos N mensajes, en orden; el historial debe empezar con un mensaje del usuario.
        $history = $conversation->messages()->latest('id')->limit(config('cerebro.chat.history'))->get()
            ->reverse()
            ->skipUntil(fn (Message $message) => $message->role === 'user')
            ->map->toPrism()
            ->values()
            ->all();

        // Chip con respuesta escrita: sale al instante, sin gastar tokens.
        if ($answer = $knowledge->answer($data['message'])) {
            $conversation->messages()->create(['role' => 'assistant', 'content' => $answer]);

            return response()->stream(function () use ($answer) {
                $this->send(['delta' => $answer]);
                $this->send(['done' => true]);
            }, 200, $this->streamHeaders());
        }

        return response()->stream(function () use ($conversation, $history, $knowledge) {
            set_time_limit(120); // el LLM puede tardar; 30s por defecto no alcanza con reintento
            $reply = '';

            // Modelo principal y, si falla antes de responder, el de respaldo.
            $models = array_filter([config('cerebro.llm.model'), config('cerebro.llm.fallback_model')]);

            foreach ($models as $model) {
                try {
                    $stream = Prism::text()
                        ->using(config('cerebro.llm.provider'), $model)
                        ->withSystemPrompt($knowledge->systemPrompt())
                        ->withMessages($history)
                        ->withMaxTokens(config('cerebro.llm.max_tokens'))
                        ->asStream();

                    foreach ($stream as $event) {
                        if ($event instanceof TextDeltaEvent) {
                            $reply .= $event->delta;
                            $this->send(['delta' => $event->delta]);
                        } elseif ($event instanceof ErrorEvent) {
                            throw new \RuntimeException("{$event->errorType}: {$event->message}");
                        }
                    }

                    break;
                } catch (Throwable $e) {
                    report($e);

                    if ($reply !== '' || $model === end($models)) {
                        $this->send(['error' => 'Ahora no pude responder 🙏 Escríbeme por WhatsApp y te atiendo.']);
                        break;
                    }
                }
            }

            if ($reply !== '') {
                $conversation->messages()->create(['role' => 'assistant', 'content' => $reply]);
            }

            $this->send(['done' => true]);
        }, 200, $this->streamHeaders());
    }

    private function streamHeaders(): array
    {
        return [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ];
    }

    private function send(array $payload): void
    {
        echo 'data: '.json_encode($payload, JSON_UNESCAPED_UNICODE)."\n\n";

        if (ob_get_level() > 0) {
            ob_flush();
        }

        flush();
    }
}
