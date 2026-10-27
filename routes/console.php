<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Recordatorio por Telegram cuando empieza una franja de llamadas.
Schedule::command('calls:remind')->everyMinute()->withoutOverlapping();
