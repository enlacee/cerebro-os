<?php

use App\Http\Controllers\ChatController;
use Illuminate\Support\Facades\Route;

Route::get('/widget', fn () => response()->json(config('cerebro.widget'))
    ->header('Cache-Control', 'public, max-age=300'));

Route::post('/chat', ChatController::class)->middleware('throttle:chat');
