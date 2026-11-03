<?php

namespace Tests\Feature;

use App\Models\CallRequest;
use App\Models\Conversation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MaintenanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_prune_deletes_only_expired_personal_data(): void
    {
        $this->travelTo(now()->subDays(100));
        $oldCall = CallRequest::create(['name' => 'Vieja', 'whatsapp' => '51999888777', 'project' => 'App', 'slot_start' => now(), 'slot_end' => now()->addHour()]);
        $oldChat = Conversation::create(['session_id' => fake()->uuid()]);
        $this->travelBack();

        $this->travelTo(now()->subDays(200));
        $staleChat = Conversation::create(['session_id' => fake()->uuid()]);
        $staleChat->messages()->create(['role' => 'user', 'content' => 'hola']);
        $this->travelBack();

        $newCall = CallRequest::create(['name' => 'Nueva', 'whatsapp' => '51999888777', 'project' => 'App', 'slot_start' => now(), 'slot_end' => now()->addHour()]);

        $this->artisan('data:prune')->assertSuccessful();

        $this->assertModelMissing($oldCall);
        $this->assertModelExists($newCall);
        $this->assertModelExists($oldChat); // 100 días < 180
        $this->assertModelMissing($staleChat);
        $this->assertDatabaseCount('messages', 0);
    }
}
