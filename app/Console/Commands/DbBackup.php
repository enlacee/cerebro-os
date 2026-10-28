<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class DbBackup extends Command
{
    protected $signature = 'db:backup';

    protected $description = 'Copia la base SQLite (consistente aunque esté en uso) y borra las copias más viejas';

    public function handle(): int
    {
        $dir = config('cerebro.backup.path');
        File::ensureDirectoryExists($dir);

        $file = $dir.'/database-'.now()->format('Y-m-d-His').'.sqlite';

        // VACUUM INTO crea una copia limpia sin detener la app (copiar el archivo a mano puede salir corrupto).
        DB::statement('VACUUM INTO ?', [$file]);

        $old = collect(File::glob($dir.'/database-*.sqlite'))->sort()->reverse()->slice(config('cerebro.backup.keep'));
        File::delete($old->all());

        $this->info('Backup: '.basename($file).' · borradas '.$old->count().' copias viejas');

        return self::SUCCESS;
    }
}
