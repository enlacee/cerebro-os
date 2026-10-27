<?php

use App\Http\Controllers\ChatController;
use Illuminate\Support\Facades\Route;

Route::get('/widget', fn () => response()->json(config('cerebro.widget'))
    ->header('Cache-Control', 'no-cache'));

Route::post('/chat', ChatController::class)->middleware('throttle:chat');
