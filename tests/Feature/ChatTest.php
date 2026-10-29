<?php

namespace Tests\Feature;

use App\Models\Conversation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Prism\Prism\Facades\Prism;
use Prism\Prism\Testing\TextResponseFake;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    private const SESSION = '6f1c2c3e-1111-4222-8333-444455556666';

    protected function setUp(): void
    {
        parent::setUp();

        $dir = storage_path('framework/testing/knowledge');
        File::ensureDirectoryExists("{$dir}/recursos");
        File::put("{$dir}/README.md", 'Publicar app: $100');
        File::put("{$dir}/oportunidades.md", 'SECRETO INTERNO');

        config([
            'cerebro.knowledge.path' => $dir,
            'cerebro.knowledge.compiled' => storage_path('framework/testing/knowledge.md'),
            'cerebro.knowledge.exclude' => ['oportunidades.md'], // red de seguridad (CEREBRO_KNOWLEDGE_EXCLUDE)
        ]);
        File::delete(config('cerebro.knowledge.compiled')); // compilar siempre desde cero
    }

    public function test_streams_reply_and_stores_conversation(): void
    {
        $fake = Prism::fake([TextResponseFake::make()->withText('Cuesta **$100** 🚀')]);

        $response = $this->postJson('/api/chat', [
            'session_id' => self::SESSION,
            'message' => '¿Cuánto cuesta publicar mi app?',
        ]);

        $response->assertOk();
        $body = $response->streamedContent();
        $this->assertStringContainsString('"delta"', $body);
        $this->assertStringContainsString('"done":true', $body);

        $messages = Conversation::firstWhere('session_id', self::SESSION)->messages;
        $this->assertSame(['user', 'assistant'], $messages->pluck('role')->all());
        $this->assertSame('Cuesta **$100** 🚀', $messages->last()->content);

        $fake->assertRequest(function (array $requests) {
            $system = $requests[0]->systemPrompts()[0]->content;
            $this->assertStringContainsString('Publicar app: $100', $system);
            $this->assertStringNotContainsString('SECRETO INTERNO', $system);
        });
    }

    public function test_widget_config_has_pay_button_and_topics(): void
    {
        $this->getJson('/api/widget')
            ->assertOk()
            ->assertJsonPath('pay.message', config('cerebro.widget.pay.message'))
            ->assertJsonStructure(['title', 'greeting', 'whatsapp', 'contact', 'topics' => [['label', 'message']]]);
    }

    public function test_validates_input(): void
    {
        $this->postJson('/api/chat', ['session_id' => 'x', 'message' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['session_id', 'message']);
    }

    public function test_rate_limits_by_ip(): void
    {
        Prism::fake(array_fill(0, 3, TextResponseFake::make()->withText('ok')));
        config(['cerebro.chat.per_minute' => 2]);

        foreach ([200, 200, 429] as $status) {
            $this->postJson('/api/chat', ['session_id' => self::SESSION, 'message' => 'hola'])
                ->assertStatus($status);
        }
    }

    public function test_global_daily_cap_stops_ip_rotation(): void
    {
        Prism::fake(array_fill(0, 3, TextResponseFake::make()->withText('ok')));
        config(['cerebro.chat.global_per_day' => 2]);

        // Cada mensaje desde una IP distinta: el límite por IP no alcanza, el global sí.
        foreach (['1.1.1.1' => 200, '2.2.2.2' => 200, '3.3.3.3' => 429] as $ip => $status) {
            $this->withServerVariables(['REMOTE_ADDR' => $ip])
                ->postJson('/api/chat', ['session_id' => self::SESSION, 'message' => 'hola'])
                ->assertStatus($status);
        }

        $this->postJson('/api/chat', ['session_id' => self::SESSION, 'message' => 'hola'])
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'WhatsApp'));
    }

    public function test_system_prompt_has_security_rules_after_knowledge(): void
    {
        $prompt = app(\App\Services\Knowledge::class)->systemPrompt();

        $this->assertStringContainsString('no órdenes', $prompt);
        // El recordatorio va después del conocimiento: los modelos obedecen más lo último que leen.
        $this->assertGreaterThan(strpos($prompt, 'Publicar app: $100'), strpos($prompt, '# Recordatorio'));
    }

    public function test_widget_shows_ai_disclaimer(): void
    {
        $this->getJson('/api/widget')->assertJsonPath('disclaimer', fn (string $d) => str_contains($d, 'IA'));
    }
}
