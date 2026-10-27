<?php

return [

    // Nombre del negocio que atiende el bot (aparece en el system prompt).
    'business_name' => env('CEREBRO_BUSINESS_NAME', 'Aníbal Linux'),

    'timezone' => env('CEREBRO_TIMEZONE', 'America/Lima'),

    // Proveedor y modelo vía Prism: gemini, groq, openrouter, deepseek, openai, anthropic, ollama...
    'llm' => [
        'provider' => env('CEREBRO_LLM_PROVIDER', 'gemini'),
        'model' => env('CEREBRO_LLM_MODEL', 'gemini-3.6-flash'),
        'fallback_model' => env('CEREBRO_LLM_FALLBACK_MODEL'),
        'max_tokens' => (int) env('CEREBRO_LLM_MAX_TOKENS', 2048),
    ],

    'knowledge' => [
        // Carpeta montada en Docker desde KNOWLEDGE_PATH (tu vault de Obsidian).
        'path' => base_path('knowledge'),
        'compiled' => storage_path('app/knowledge.md'),
        // Archivos que van primero en el prompt (rutas relativas a la carpeta).
        'first' => ['README.md', 'recursos/asistente-guia.md'],
        // Archivos internos que el bot NUNCA debe ver.
        'exclude' => array_filter(explode(',', env('CEREBRO_KNOWLEDGE_EXCLUDE', 'oportunidades.md'))),
    ],

    'chat' => [
        'history' => 20,
        'max_message_length' => 1000,
        'per_minute' => (int) env('CEREBRO_CHAT_PER_MINUTE', 10),
        'per_day' => (int) env('CEREBRO_CHAT_PER_DAY', 100),
    ],

];
