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
        // El visitante ve el chat abierto; el código para pegar va plegado ("Ver más").
        $this->assertStringContainsString('src="/widget.js" data-open', $html);
        $this->assertStringContainsString('<details class="embed">', $html);
        $this->assertStringNotContainsString('<details class="embed" open', $html);
    }
}
