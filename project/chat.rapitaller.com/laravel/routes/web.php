<?php

use Illuminate\Support\Facades\Route;

// La raíz muestra la página demo con el chat.
Route::get('/', fn () => response()->file(public_path('demo.html')));
