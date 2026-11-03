<?php

namespace Tests\Feature;

use App\Providers\AppServiceProvider;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class TrustedProxyTest extends TestCase
{
    protected function tearDown(): void
    {
        TrustProxies::flushState();
        parent::tearDown();
    }

    private function clientIp(string $trusted, string $remote, string $forwarded): string
    {
        config(['cerebro.trusted_proxies' => array_filter(explode(',', $trusted))]);
        $this->app->getProvider(AppServiceProvider::class)->boot();
        Route::get('/_ip', fn () => request()->ip());

        return $this->withServerVariables(['REMOTE_ADDR' => $remote])
            ->withHeader('X-Forwarded-For', $forwarded)
            ->get('/_ip')->getContent();
    }

    public function test_without_trusted_proxies_the_header_is_ignored(): void
    {
        // Nadie puede falsificar su IP mandando la cabecera a mano.
        $this->assertSame('203.0.113.9', $this->clientIp('', '203.0.113.9', '1.2.3.4'));
    }

    public function test_behind_nginx_proxy_uses_visitor_ip(): void
    {
        $this->assertSame('1.2.3.4', $this->clientIp('docker', '172.18.0.2', '1.2.3.4'));
    }

    public function test_behind_cloudflare_and_nginx_proxy_uses_visitor_ip(): void
    {
        // Visitante → Cloudflare (162.158.x) → nginx-proxy (172.18.x) → app
        $this->assertSame('1.2.3.4', $this->clientIp('docker,cloudflare', '172.18.0.2', '1.2.3.4, 162.158.10.20'));
    }

    public function test_spoofed_header_from_outside_is_ignored(): void
    {
        // Alguien que no es Cloudflare intenta colarse una IP falsa: se toma la IP de quien conecta.
        $this->assertSame('8.8.8.8', $this->clientIp('docker,cloudflare', '172.18.0.2', '1.2.3.4, 8.8.8.8'));
    }
}
