<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Middleware\TrustProxies;
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
        // Detrás de un proxy, $request->ip() sería la del proxy y el límite por IP bloquearía a todos a la vez.
        TrustProxies::at(collect(config('cerebro.trusted_proxies'))
            ->flatMap(fn (string $item) => config('cerebro.proxy_ranges.'.trim($item), [trim($item)]))
            ->all());

        // Protege la cuota del LLM: límite por minuto y por día para cada IP.
        RateLimiter::for('chat', fn (Request $request) => [
            Limit::perMinute(config('cerebro.chat.per_minute'))->by($request->ip()),
            Limit::perDay(config('cerebro.chat.per_day'))->by('day:'.$request->ip()),
        ]);

        RateLimiter::for('call-request', fn (Request $request) => Limit::perDay(config('cerebro.calls.per_day'))->by($request->ip()));
    }
}
