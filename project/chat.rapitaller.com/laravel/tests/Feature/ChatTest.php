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

    public function test_topic_with_written_answer_skips_the_llm(): void
    {
        $fake = Prism::fake([]);
        File::ensureDirectoryExists(config('cerebro.knowledge.path').'/respuestas');
        File::put(config('cerebro.knowledge.path').'/respuestas/publicar.md', "---\ntitle: Publicar\n---\n\nPublicar cuesta **\$100** 🚀\n");
        config(['cerebro.knowledge.answers' => ['Quiero publicar mi app' => 'respuestas/publicar.md']]);

        $body = $this->postJson('/api/chat', ['session_id' => self::SESSION, 'message' => 'Quiero publicar mi app'])
            ->assertOk()
            ->streamedContent();

        $this->assertStringContainsString('Publicar cuesta **$100** 🚀', $body);
        $this->assertStringContainsString('"done":true', $body);
        $fake->assertCallCount(0);

        // Queda en el historial para que la IA tenga contexto en la siguiente pregunta.
        $messages = Conversation::firstWhere('session_id', self::SESSION)->messages;
        $this->assertSame(['user', 'assistant'], $messages->pluck('role')->all());
        $this->assertSame('Publicar cuesta **$100** 🚀', $messages->last()->content);
    }

    public function test_topic_without_answer_or_outside_knowledge_goes_to_the_llm(): void
    {
        $fake = Prism::fake([TextResponseFake::make()->withText('ok'), TextResponseFake::make()->withText('ok')]);
        File::put(storage_path('framework/testing/fuera.md'), 'FUERA DEL VAULT');
        config(['cerebro.knowledge.answers' => [
            'Ruta mala' => '../fuera.md',
            'Archivo que no existe' => 'respuestas/no-existe.md',
        ]]);

        foreach (['Ruta mala', 'Archivo que no existe'] as $message) {
            $body = $this->postJson('/api/chat', ['session_id' => self::SESSION, 'message' => $message])->streamedContent();
            $this->assertStringNotContainsString('FUERA DEL VAULT', $body);
        }

        $fake->assertCallCount(2);
    }

    public function test_widget_config_has_pay_button_and_topics(): void
    {
        $this->getJson('/api/widget')
            ->assertOk()
            ->assertJsonPath('pay.message', config('cerebro.widget.pay.message'))
            ->assertJsonStructure(['title', 'greeting', 'whatsapp', 'contact', 'topics' => [['label', 'message']]]);
    }

    public function test_widget_config_has_rating_and_only_safe_links(): void
    {
        // Se relee config/cerebro.php con otras variables (Laravel lee primero $_SERVER y $_ENV).
        $vars = [
            'CEREBRO_RATING' => '4.9',
            'CEREBRO_RATING_SOURCE' => 'Google',
            'CEREBRO_RATING_URL' => 'https://maps.app.goo.gl/x',
            'CEREBRO_LINKS' => 'blog|https://blog.ejemplo.com/|Mi blog, youtube|javascript:alert(1), Mi tienda|https://tienda.ejemplo.com',
        ];
        $backup = [$_SERVER, $_ENV];
        foreach ($vars as $key => $value) {
            $_SERVER[$key] = $_ENV[$key] = $value;
        }

        try {
            $widget = (require config_path('cerebro.php'))['widget'];
        } finally {
            [$_SERVER, $_ENV] = $backup;
        }

        $this->assertSame(['value' => '4.9', 'source' => 'Google', 'url' => 'https://maps.app.goo.gl/x'], $widget['rating']);
        $this->assertSame([
            ['type' => 'blog', 'label' => 'Mi blog', 'url' => 'https://blog.ejemplo.com/'],
            ['type' => 'mi tienda', 'label' => 'Mi tienda', 'url' => 'https://tienda.ejemplo.com'],
        ], $widget['links']);
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
