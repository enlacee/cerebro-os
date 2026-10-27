<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('call_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 80);
            $table->string('whatsapp', 20); // solo dígitos, con código de país
            $table->string('project', 300);
            $table->dateTime('slot_start');
            $table->dateTime('slot_end');
            $table->string('status', 16)->default('pending'); // pending | done | missed
            $table->dateTime('reminded_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('call_requests');
    }
};
