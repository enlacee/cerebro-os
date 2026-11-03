<?php

// Lo que cambia de un negocio a otro va en el .env (sección "Chat"); este archivo es igual en todas las instancias.
$business = env('CEREBRO_BUSINESS_NAME', 'Mi negocio');
$owner = env('CEREBRO_OWNER_NAME') ?: $business; // quien atiende: "Hablar con …", "Que … me llame"
$retentionCalls = (int) env('CEREBRO_RETENTION_CALLS_DAYS', 90);

// "1-5" o "1,3,5" (ISO: 1 = lunes … 7 = domingo).
$days = collect(explode(',', env('CEREBRO_CALL_DAYS', '1-5')))
    ->flatMap(fn (string $part) => str_contains($part, '-') ? range(...array_map('intval', explode('-', $part, 2))) : [(int) $part])
    ->values()->all();

// "11:00-12:00,15:00-16:00"
$hours = array_map(
    fn (string $range) => array_map('trim', explode('-', $range, 2)),
    array_filter(explode(',', env('CEREBRO_CALL_HOURS', '11:00-12:00,15:00-16:00')))
);

// CEREBRO_TOPIC_1 … _8: "texto del botón | mensaje que se envía | respuesta escrita (opcional)"
// La respuesta es un .md de knowledge/ (ej. respuestas/publicar-app.md): sale al instante, sin IA.
$topics = [];
$answers = [];
foreach (range(1, 8) as $i) {
    if (filled($topic = env("CEREBRO_TOPIC_{$i}"))) {
        [$label, $message, $answer] = array_map('trim', explode('|', $topic, 3)) + [1 => null, 2 => null];
        $topics[] = ['label' => $label, 'message' => $message ?: $label];

        if (filled($answer)) {
            $answers[$message ?: $label] = $answer;
        }
    }
}

// CEREBRO_LINKS: "tipo|url|texto (opcional), …" (tipo: blog, web, youtube, tiktok, facebook, instagram, linkedin u otro).
// Solo http(s): nada de javascript: ni otros esquemas.
$names = ['blog' => 'Blog', 'web' => 'Web', 'youtube' => 'YouTube', 'tiktok' => 'TikTok', 'facebook' => 'Facebook', 'instagram' => 'Instagram', 'linkedin' => 'LinkedIn'];
$links = collect(explode(',', env('CEREBRO_LINKS', '')))
    ->map(fn (string $link) => array_map('trim', explode('|', $link, 3)) + [1 => '', 2 => ''])
    ->filter(fn (array $link) => filled($link[0]) && preg_match('#^https?://#i', $link[1]) && filter_var($link[1], FILTER_VALIDATE_URL))
    ->map(fn (array $link) => ['type' => strtolower($link[0]), 'label' => $link[2] ?: ($names[strtolower($link[0])] ?? $link[0]), 'url' => $link[1]])
    ->values()->all();

$ratingUrl = env('CEREBRO_RATING_URL', '');

return [

    // Nombre del negocio que atiende el bot (aparece en el system prompt).
    'business_name' => $business,
    'owner_name' => $owner,

    'timezone' => env('CEREBRO_TIMEZONE', 'America/Lima'),

    // Proveedor y modelo vía Prism: gemini, groq, openrouter, deepseek, openai, anthropic, ollama...
    'llm' => [
        'provider' => env('CEREBRO_LLM_PROVIDER', 'gemini'),
        'model' => env('CEREBRO_LLM_MODEL', 'gemini-3.6-flash'),
        'fallback_model' => env('CEREBRO_LLM_FALLBACK_MODEL'),
        'max_tokens' => (int) env('CEREBRO_LLM_MAX_TOKENS', 800),
    ],

    'knowledge' => [
        // Vault de Obsidian de la instancia (../knowledge), montado en Docker. Todo lo que hay ahí es público.
        'path' => base_path('knowledge'),
        'compiled' => storage_path('app/knowledge.md'),
        // Archivos que van primero en el prompt (rutas relativas a la carpeta).
        'first' => ['README.md', 'recursos/asistente-guia.md'],
        // Red de seguridad: archivos que el bot no debe leer aunque estén en la carpeta.
        'exclude' => array_filter(explode(',', env('CEREBRO_KNOWLEDGE_EXCLUDE', ''))),
        // Respuestas escritas de los chips: mensaje => archivo (ver CEREBRO_TOPIC_*).
        'answers' => $answers,
    ],

    'chat' => [
        'history' => 10, // mensajes de contexto: menos costo y menos superficie para manipular al bot
        'max_message_length' => 1000,
        'per_minute' => (int) env('CEREBRO_CHAT_PER_MINUTE', 10),
        'per_day' => (int) env('CEREBRO_CHAT_PER_DAY', 100),
        // Tope de toda la instancia (frena a quien rota IPs y protege la cuota del LLM).
        'global_per_day' => (int) env('CEREBRO_CHAT_GLOBAL_PER_DAY', 1000),
    ],

    // "Que me llame": franjas internas en las que se aceptan llamadas (hora de 'timezone').
    'calls' => [
        'days' => $days,
        'windows' => $hours,
        'slots_shown' => 3,
        'slots_max' => 9, // el widget pide más si las primeras le caen de madrugada al visitante
        'timezone_label' => env('CEREBRO_CALL_TIMEZONE_LABEL', 'hora local'),
        'per_day' => (int) env('CEREBRO_CALLS_PER_DAY', 3), // solicitudes por IP al día
    ],

    // Ley 29733 (Perú): no guardar datos personales más de lo necesario. Ver: php artisan data:prune
    'retention' => [
        'calls_days' => $retentionCalls,
        'conversations_days' => (int) env('CEREBRO_RETENTION_CONVERSATIONS_DAYS', 180),
    ],

    // Proxies de confianza (nginx-proxy, Cloudflare…): de ellos se toma la IP real del visitante
    // (X-Forwarded-For) para el límite por IP. "docker" = redes privadas; "cloudflare" = sus rangos.
    'trusted_proxies' => array_filter(explode(',', env('CEREBRO_TRUSTED_PROXIES', ''))),

    'proxy_ranges' => [
        'docker' => ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7'],
        // https://www.cloudflare.com/ips/
        'cloudflare' => [
            '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
            '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
            '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
            '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
            '2a06:98c0::/29', '2c0f:f248::/32',
        ],
    ],

    // Copias diarias de SQLite (php artisan db:backup). En producción van al volumen de datos.
    'backup' => [
        'path' => env('CEREBRO_BACKUP_PATH', storage_path('app/backups')),
        'keep' => (int) env('CEREBRO_BACKUP_KEEP', 14),
    ],

    // Avisos al dueño (nuevas llamadas y recordatorios). Ver: php artisan telegram:setup
    'telegram' => [
        'token' => env('TELEGRAM_BOT_TOKEN'),
        'chat_id' => env('TELEGRAM_CHAT_ID'),
    ],

    // Lo que ve el visitante al abrir el chat (lo entrega GET /api/widget).
    'widget' => [
        'title' => $business,
        'subtitle' => 'En línea',
        'greeting' => env('CEREBRO_GREETING', "¡Hola! 👋 Soy el asistente de {$business}. ¿Qué necesitas?"),
        'disclaimer' => 'Respuestas con IA · pueden tener errores',
        // Colores (estilo sobrio tipo Google): azul = asistente, verde = WhatsApp (lo único verde para que
        // "quiero pagar" destaque), cabecera clara. En modo oscuro la cabecera pasa a gris oscuro sola.
        'colors' => [
            'accent' => env('CEREBRO_COLOR_ACCENT', '#1a73e8'),
            'whatsapp' => '#188038',
            'header' => '#ffffff',
            'header_text' => '#202124',
        ],
        'whatsapp' => env('CEREBRO_WHATSAPP', ''),

        // Botón fijo arriba: hablar con una persona.
        'contact' => [
            'label' => "Hablar con {$owner} por WhatsApp", // tooltip y lectores de pantalla
            'short' => 'WhatsApp', // texto del botón (≤360px queda solo el logo)
            'message' => "Hola {$owner}, vengo del chat de la web 👋",
        ],

        // Camino directo para quien ya decidió: WhatsApp sin pasar por la IA.
        'pay' => [
            'title' => '💳 Ya decidí, quiero pagar',
            'short' => '💳 Quiero pagar', // texto del botón; title/subtitle quedan como descripción
            'subtitle' => "Hablar con {$owner} por WhatsApp",
            'message' => "Hola {$owner}, ya decidí y quiero pagar 🙌",
        ],

        // Llamada rápida: el visitante deja su WhatsApp y elige una franja.
        'call' => [
            'title' => "📞 Prefiero que {$owner} me llame",
            'subtitle' => 'Llamada rápida por WhatsApp · 3 min',
            'short' => "📞 Que {$owner} me llame",
            'intro' => env('CEREBRO_CALL_INTRO', 'Llamada rápida por WhatsApp (3 min) para conocerte y saber de tu proyecto.'),
            'country_code' => env('CEREBRO_CALL_COUNTRY_CODE', '+51'), // si no se detecta el país del visitante
            'privacy' => "🔒 Tus datos solo se usan para esta llamada y se borran a los {$retentionCalls} días.",
        ],

        // Chips: al tocarlos se envía "message" al asistente.
        'topics_title' => env('CEREBRO_TOPICS_TITLE', 'Lo más buscado'),
        'topics' => $topics,

        // Prueba social en la bienvenida: "⭐ 4.9 en Google · Ver reseñas". Sin CEREBRO_RATING no se muestra.
        'rating' => filled(env('CEREBRO_RATING')) ? [
            'value' => (string) env('CEREBRO_RATING'),
            'source' => env('CEREBRO_RATING_SOURCE', 'Google'),
            'url' => preg_match('#^https?://#i', $ratingUrl) ? $ratingUrl : null,
        ] : null,

        // Link(s) del dueño al pie de la bienvenida (CEREBRO_LINKS). Recomendado: uno solo.
        'links' => $links,
    ],

];
