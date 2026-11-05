<?php

namespace Tests\Feature;

use App\Models\Conversation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatViewTest extends TestCase
{
    use RefreshDatabase;

    public function test_lists_searches_and_shows_conversations(): void
    {
        $chat = Conversation::create(['session_id' => fake()->uuid(), 'page_url' => 'https://anibalcopitan.com/']);
        $chat->messages()->create(['role' => 'user', 'content' => 'Quiero publicar mi app']);
        $chat->messages()->create(['role' => 'assistant', 'content' => 'Cuesta $100']);
        Conversation::create(['session_id' => fake()->uuid()])->messages()->create(['role' => 'user', 'content' => 'Hola']);

        $this->artisan('chat:ver')->expectsOutputToContain('Quiero publicar mi app')->assertSuccessful();
        $this->artisan('chat:ver', ['--buscar' => 'publicar'])->doesntExpectOutputToContain('Hola')->assertSuccessful();
        $this->artisan('chat:ver', ['id' => $chat->id])->expectsOutputToContain('Cuesta $100')->assertSuccessful();
        $this->artisan('chat:ver', ['id' => 999])->assertFailed();
    }
}
