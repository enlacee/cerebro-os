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

    // Lo que ve el visitante al abrir el chat (lo entrega GET /api/widget).
    'widget' => [
        'title' => env('CEREBRO_BUSINESS_NAME', 'Aníbal Linux'),
        'greeting' => '¡Hola! 👋 Soy el asistente de Aníbal Linux. ¿Qué necesitas?',
        'color' => '#16a34a',
        'whatsapp' => env('CEREBRO_WHATSAPP', '51970142637'),

        // Botón fijo arriba: hablar con una persona.
        'contact' => [
            'label' => 'Hablar con Aníbal',
            'message' => 'Hola Aníbal, vengo del chat de la web 👋',
        ],

        // Camino directo para quien ya decidió: WhatsApp sin pasar por la IA.
        'pay' => [
            'title' => '💳 Ya decidí, quiero pagar',
            'subtitle' => 'Hablar con Aníbal por WhatsApp',
            'message' => 'Hola Aníbal, ya decidí y quiero pagar 🙌',
        ],

        // Chips: al tocarlos se envía "message" al asistente.
        'topics_title' => 'O pregúntale al asistente:',
        'topics' => [
            ['label' => '📱 Crear mi app Android', 'message' => 'Quiero crear mi propia app Android'],
            ['label' => '🚀 Publicar mi app Android/iOS', 'message' => 'Quiero publicar mi app en Play Store o App Store'],
            ['label' => '🤝 Asesoría / Acompañamiento', 'message' => 'Quiero una asesoría o acompañamiento'],
            ['label' => '🐧 Aprender Linux', 'message' => 'Quiero aprender Linux'],
            ['label' => '🖥️ Mi servidor en casa / VPS', 'message' => 'Quiero crear mi servidor en casa o VPS'],
            ['label' => '⭐ Ver tus apps publicadas', 'message' => 'Quiero ver tus apps publicadas'],
        ],
    ],

];
