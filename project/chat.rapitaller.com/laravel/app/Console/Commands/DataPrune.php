<?php

namespace App\Console\Commands;

use App\Models\CallRequest;
use App\Models\Conversation;
use Illuminate\Console\Command;

class DataPrune extends Command
{
    protected $signature = 'data:prune';

    protected $description = 'Borra llamadas y conversaciones más viejas que el plazo de retención (datos personales)';

    public function handle(): int
    {
        $calls = CallRequest::where('created_at', '<', now()->subDays(config('cerebro.retention.calls_days')))->delete();

        // Los mensajes se borran en cascada con su conversación.
        $conversations = Conversation::where('updated_at', '<', now()->subDays(config('cerebro.retention.conversations_days')))->delete();

        $this->info("Borradas: {$calls} llamadas · {$conversations} conversaciones");

        return self::SUCCESS;
    }
}
