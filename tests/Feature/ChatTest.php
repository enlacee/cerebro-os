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
}
