<?php

namespace App\Console\Commands;

use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class ChatView extends Command
{
    protected $signature = 'chat:ver
        {id? : Número de la conversación a mostrar completa}
        {--n=20 : Cuántas conversaciones listar}
        {--buscar= : Solo las que tengan este texto en algún mensaje}';

    protected $description = 'Lista las últimas conversaciones del chat o muestra una completa';

    public function handle(): int
    {
        return $this->argument('id') ? $this->show((int) $this->argument('id')) : $this->list();
    }

    private function list(): int
    {
        $query = Conversation::withCount('messages')
            ->with(['messages' => fn ($q) => $q->where('role', 'user')->orderBy('id')])
            ->latest('id')
            ->limit(max(1, (int) $this->option('n')));

        if ($text = $this->option('buscar')) {
            $query->whereHas('messages', fn ($q) => $q->where('content', 'like', "%{$text}%"));
        }

        $conversations = $query->get();

        if ($conversations->isEmpty()) {
            $this->info('No hay conversaciones.');

            return self::SUCCESS;
        }

        $this->table(['#', 'Fecha', 'Msjs', 'Primer mensaje', 'Página'], $conversations->map(fn (Conversation $c) => [
            $c->id,
            $this->date($c->updated_at),
            $c->messages_count,
            Str::limit($this->oneLine($c->messages->first()?->content ?? ''), 50),
            Str::limit((string) parse_url((string) $c->page_url, PHP_URL_HOST), 25, ''),
        ]));

        $this->line('<fg=gray>Ver una completa: php artisan chat:ver <#></>');

        return self::SUCCESS;
    }

    private function show(int $id): int
    {
        $conversation = Conversation::with(['messages' => fn ($q) => $q->orderBy('id')])->find($id);

        if (! $conversation) {
            $this->error("No existe la conversación #{$id}.");

            return self::FAILURE;
        }

        $this->line("<options=bold>Conversación #{$conversation->id}</> · {$this->date($conversation->created_at)} · ".($conversation->page_url ?: 'sin página'));
        $this->line('<fg=gray>'.Str::limit((string) $conversation->user_agent, 100).'</>');

        foreach ($conversation->messages as $message) {
            /** @var Message $message */
            $time = $this->date($message->created_at, 'H:i');
            $this->newLine();
            $this->line($message->role === 'user'
                ? "<fg=green;options=bold>👤 Visitante</> <fg=gray>{$time}</>"
                : "<fg=blue;options=bold>🤖 Bot</> <fg=gray>{$time}</>");
            $this->line(trim($message->content));
        }

        return self::SUCCESS;
    }

    // Fecha en la hora del dueño (se guarda en UTC).
    private function date(?Carbon $date, string $format = 'd/m H:i'): string
    {
        return $date?->timezone(config('cerebro.timezone'))->format($format) ?? '';
    }

    private function oneLine(string $text): string
    {
        return trim(preg_replace('/\s+/', ' ', $text));
    }
}
