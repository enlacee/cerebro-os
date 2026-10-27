<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Protege la cuota del LLM: límite por minuto y por día para cada IP.
        RateLimiter::for('chat', fn (Request $request) => [
            Limit::perMinute(config('cerebro.chat.per_minute'))->by($request->ip()),
            Limit::perDay(config('cerebro.chat.per_day'))->by('day:'.$request->ip()),
        ]);

        RateLimiter::for('call-request', fn (Request $request) => Limit::perDay(config('cerebro.calls.per_day'))->by($request->ip()));
    }
}
