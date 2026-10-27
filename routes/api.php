<?php

use App\Http\Controllers\CallRequestController;
use App\Http\Controllers\ChatController;
use Illuminate\Support\Facades\Route;

Route::get('/widget', fn () => response()->json(config('cerebro.widget'))
    ->header('Cache-Control', 'no-cache'));

Route::post('/chat', ChatController::class)->middleware('throttle:chat');

Route::get('/call-slots', [CallRequestController::class, 'slots']);
Route::post('/call-request', [CallRequestController::class, 'store'])->middleware('throttle:call-request');
