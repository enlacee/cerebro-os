<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Prism\Prism\ValueObjects\Messages\AssistantMessage;
use Prism\Prism\ValueObjects\Messages\UserMessage;

class Message extends Model
{
    protected $fillable = ['role', 'content'];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function toPrism(): UserMessage|AssistantMessage
    {
        return $this->role === 'user'
            ? new UserMessage($this->content)
            : new AssistantMessage($this->content);
    }
}
