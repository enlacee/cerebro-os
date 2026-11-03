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
        $tooMany = fn (string $message) => fn () => response()->json(['message' => $message], 429);

        RateLimiter::for('chat', fn (Request $request) => [
            Limit::perMinute(config('cerebro.chat.per_minute'))->by($request->ip())
                ->response($tooMany('Estás enviando muchos mensajes. Espera un momento 🙏')),
            Limit::perDay(config('cerebro.chat.per_day'))->by('day:'.$request->ip())
                ->response($tooMany('Llegaste al límite de mensajes de hoy 🙏 Escríbenos por WhatsApp y te atendemos.')),
            Limit::perDay(config('cerebro.chat.global_per_day'))->by('global')
                ->response($tooMany('El chat llegó a su límite de hoy 🙏 Escríbenos por WhatsApp y te atendemos.')),
        ]);

        RateLimiter::for('call-request', fn (Request $request) => Limit::perDay(config('cerebro.calls.per_day'))->by($request->ip()));
    }
}
