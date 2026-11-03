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
        // El visitante ve el chat abierto, no el código para pegar.
        $this->assertStringContainsString('src="/widget.js" data-open', $html);
        $this->assertStringNotContainsString('Copiar', $html);
    }
}
