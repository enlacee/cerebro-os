<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use Tests\TestCase;

// Sin RefreshDatabase: VACUUM no puede correr dentro de una transacción.
class BackupTest extends TestCase
{
    public function test_backup_keeps_only_latest_copies(): void
    {
        $dir = storage_path('framework/testing/backups');
        File::deleteDirectory($dir);
        config(['cerebro.backup.path' => $dir, 'cerebro.backup.keep' => 2]);
        File::ensureDirectoryExists($dir);
        File::put($dir.'/database-2020-01-01-000000.sqlite', '');
        File::put($dir.'/database-2020-01-02-000000.sqlite', '');

        $this->artisan('db:backup')->assertSuccessful();

        $files = collect(File::glob($dir.'/database-*.sqlite'))->map(fn ($f) => basename($f));
        $this->assertCount(2, $files);
        $this->assertNotContains('database-2020-01-01-000000.sqlite', $files);

        File::deleteDirectory($dir);
    }
}
