<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Recordatorio por Telegram cuando empieza una franja de llamadas.
Schedule::command('calls:remind')->everyMinute()->withoutOverlapping();

// Copia diaria de SQLite y borrado de datos personales vencidos (madrugada, hora del negocio).
Schedule::command('db:backup')->dailyAt('03:00')->timezone(config('cerebro.timezone'));
Schedule::command('data:prune')->dailyAt('03:30')->timezone(config('cerebro.timezone'));
