<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CallRequest extends Model
{
    protected $fillable = ['conversation_id', 'name', 'whatsapp', 'project', 'timezone', 'slot_start', 'slot_end', 'status', 'reminded_at'];

    protected function casts(): array
    {
        return [
            'slot_start' => 'immutable_datetime',
            'slot_end' => 'immutable_datetime',
            'reminded_at' => 'immutable_datetime',
        ];
    }

    // Las franjas llegan en hora local (ej. -05:00); se guardan siempre en UTC como el resto de fechas.
    protected function slotStart(): Attribute
    {
        return Attribute::set(fn ($value) => CarbonImmutable::parse($value)->utc()->format('Y-m-d H:i:s'));
    }

    protected function slotEnd(): Attribute
    {
        return Attribute::set(fn ($value) => CarbonImmutable::parse($value)->utc()->format('Y-m-d H:i:s'));
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function whatsappLink(): string
    {
        return 'https://wa.me/'.$this->whatsapp;
    }
}
