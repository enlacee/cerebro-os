<?php

namespace Tests\Feature;

use App\Models\CallRequest;
use App\Services\CallSlots;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CallRequestTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['cerebro.telegram.token' => 'TEST', 'cerebro.telegram.chat_id' => '123']);
        Http::fake(['api.telegram.org/*' => Http::response(['ok' => true])]);
    }

    private function lima(string $datetime): CarbonImmutable
    {
        return CarbonImmutable::parse($datetime, 'America/Lima');
    }

    public function test_slots_skip_nights_and_weekends(): void
    {
        // Viernes 9 pm: lo siguiente es el lunes 11 am y 3 pm, y el martes 11 am.
        $slots = app(CallSlots::class)->next($this->lima('2026-10-30 21:00'));

        $this->assertSame(['2026-11-02T11:00', '2026-11-02T15:00', '2026-11-03T11:00'], $slots->pluck('id')->all());
        $this->assertStringStartsWith('Lunes 2 · 11:00 am – 12:00 pm', $slots[0]['label']);
    }

    public function test_slot_in_progress_is_offered_as_now(): void
    {
        $slots = app(CallSlots::class)->next($this->lima('2026-10-28 11:20'));

        $this->assertTrue($slots[0]['now']);
        $this->assertSame('Ahora (en los próximos minutos)', $slots[0]['label']);
        $this->assertStringStartsWith('Hoy · 3:00 pm', $slots[1]['label']);
        $this->assertStringStartsWith('Mañana · 11:00 am', $slots[2]['label']);
    }

    public function test_slot_with_less_than_10_minutes_left_is_skipped(): void
    {
        $slots = app(CallSlots::class)->next($this->lima('2026-10-28 11:55'));

        $this->assertSame('2026-10-28T15:00', $slots[0]['id']);
    }

    public function test_stores_request_and_notifies_telegram(): void
    {
        $this->travelTo($this->lima('2026-10-28 09:00'));

        $this->postJson('/api/call-request', [
            'name' => 'Rosa',
            'whatsapp' => '+51 999 888 777',
            'project' => 'App de delivery',
            'slot' => '2026-10-28T11:00',
        ])->assertCreated()->assertJsonPath('message', fn (string $m) => str_contains($m, 'Hoy · 11:00 am'));

        $call = CallRequest::sole();
        $this->assertSame('51999888777', $call->whatsapp);
        $this->assertSame('2026-10-28 16:00:00', $call->getRawOriginal('slot_start')); // 11 am Lima = 16:00 UTC
        $this->assertSame('pending', $call->status);

        Http::assertSent(fn (Request $request) => str_contains($request['text'], 'Rosa')
            && str_contains($request['text'], 'https://wa.me/51999888777'));
    }

    public function test_visitor_abroad_gets_both_times_and_telegram_shows_client_time(): void
    {
        $this->travelTo($this->lima('2026-10-28 09:00'));

        $this->postJson('/api/call-request', [
            'name' => 'Lucía', 'whatsapp' => '+34 600 111 222', 'project' => 'Web', 'slot' => '2026-10-28T15:00',
            'timezone' => 'Europe/Madrid',
        ])->assertCreated()
            // 3 pm en Lima = 9 pm en Madrid (horario de invierno desde el 25 de octubre).
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'Hoy · 9:00 pm – 10:00 pm (tu hora)')
                && str_contains($m, 'en Perú: Hoy · 3:00 pm – 4:00 pm (hora Perú)'));

        $this->assertSame('Europe/Madrid', CallRequest::sole()->timezone);
        Http::assertSent(fn (Request $request) => str_contains($request['text'], 'Cliente en Europe/Madrid — para él: Hoy · 9:00 pm'));
    }

    public function test_same_timezone_shows_single_time(): void
    {
        $this->travelTo($this->lima('2026-10-28 09:00'));

        $this->postJson('/api/call-request', [
            'name' => 'Rosa', 'whatsapp' => '+57 300 111 2222', 'project' => 'App', 'slot' => '2026-10-28T11:00',
            'timezone' => 'America/Bogota', // misma hora que Lima
        ])->assertCreated()->assertJsonPath('message', fn (string $m) => ! str_contains($m, 'tu hora'));
    }

    public function test_accepts_extra_slots_beyond_first_three(): void
    {
        $this->travelTo($this->lima('2026-10-28 09:00'));

        $this->getJson('/api/call-slots?count=9')->assertOk()->assertJsonCount(9, 'slots');

        // 4.ª franja (jueves 3 pm): solo se muestra si las primeras le caen de noche al visitante.
        $this->postJson('/api/call-request', [
            'name' => 'Ken', 'whatsapp' => '+81 90 1111 2222', 'project' => 'App', 'slot' => '2026-10-29T15:00', 'timezone' => 'Asia/Tokyo',
        ])->assertCreated();
    }

    public function test_rejects_invalid_timezone(): void
    {
        $this->travelTo($this->lima('2026-10-28 09:00'));

        $this->postJson('/api/call-request', [
            'name' => 'Rosa', 'whatsapp' => '+51 999 888 777', 'project' => 'App', 'slot' => '2026-10-28T11:00', 'timezone' => 'Marte/Olimpo',
        ])->assertUnprocessable()->assertJsonValidationErrors('timezone');
    }

    public function test_rejects_slot_outside_schedule(): void
    {
        $this->travelTo($this->lima('2026-10-28 09:00'));

        $this->postJson('/api/call-request', [
            'name' => 'Rosa', 'whatsapp' => '+51 999 888 777', 'project' => 'App', 'slot' => '2026-10-28T22:00',
        ])->assertUnprocessable()->assertJsonValidationErrors('slot');

        $this->assertSame(0, CallRequest::count());
    }

    public function test_honeypot_silently_ignores_bots(): void
    {
        $this->travelTo($this->lima('2026-10-28 09:00'));

        $this->postJson('/api/call-request', [
            'name' => 'bot', 'whatsapp' => '+51 999 888 777', 'project' => 'spam', 'slot' => '2026-10-28T11:00', 'website' => 'http://spam',
        ])->assertOk();

        $this->assertSame(0, CallRequest::count());
        Http::assertNothingSent();
    }

    public function test_reminds_once_when_slot_starts(): void
    {
        $this->travelTo($this->lima('2026-10-28 09:00'));
        $call = CallRequest::create([
            'name' => 'Rosa', 'whatsapp' => '51999888777', 'project' => 'App',
            'slot_start' => $this->lima('2026-10-28 11:00'), 'slot_end' => $this->lima('2026-10-28 12:00'),
        ]);

        $this->artisan('calls:remind');
        Http::assertNothingSent();

        $this->travelTo($this->lima('2026-10-28 10:56'));
        $this->artisan('calls:remind');
        $this->artisan('calls:remind');

        Http::assertSentCount(1);
        $this->assertNotNull($call->fresh()->reminded_at);
    }
}
