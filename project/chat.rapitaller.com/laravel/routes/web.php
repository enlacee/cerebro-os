<?php

use Illuminate\Support\Facades\Route;

// La raíz es la página del visitante, con el chat ya abierto.
Route::get('/', fn () => response()->file(public_path('chat.html')));
