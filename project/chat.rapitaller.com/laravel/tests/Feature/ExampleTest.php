<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    public function test_root_shows_the_chat(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
        $html = $response->streamedContent();
        // El visitante ve el chat abierto; el código para pegar va plegado ("Saber más").
        $this->assertStringContainsString('src="/widget.js" data-open', $html);
        $this->assertStringContainsString('aria-expanded="false"', $html);
        $this->assertStringContainsString('id="snippet"', $html);
    }
}
