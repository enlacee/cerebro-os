<?php

namespace App\Console\Commands;

use App\Services\Knowledge;
use Illuminate\Console\Command;

class KnowledgeSync extends Command
{
    protected $signature = 'knowledge:sync';

    protected $description = 'Compila la carpeta de conocimiento (Obsidian) en el prompt del bot';

    public function handle(Knowledge $knowledge): int
    {
        $stats = $knowledge->compile();

        foreach ($stats['files'] as $file) {
            $this->line("  • {$file}");
        }

        $this->info(sprintf(
            '✅ %d archivos · %s palabras · ~%s tokens',
            count($stats['files']),
            number_format($stats['words']),
            number_format($stats['tokens']),
        ));

        return self::SUCCESS;
    }
}
