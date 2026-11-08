# Configuración de una instancia

Cada instancia (ej. `project/chat.rapitaller.com/`) tiene **dos `.env`**. Ninguno se versiona: **git no los
lleva al VPS**. Si agregas una variable en un `.env.example`, cópiala a mano al `.env` del servidor.

| Archivo | Para qué | Plantilla |
|---|---|---|
| `.env` (carpeta de la instancia) | Docker: nombre de contenedores, dominio, puerto | `.env.example` (PC) · `.env.pro` (VPS) |
| `laravel/.env` | La app: textos del chat, IA, límites, Telegram | `laravel/.env.example` |

> El código (`laravel/`) es igual en todas las instancias: lo propio de un negocio va en `laravel/.env` o en
> `knowledge/`. Valores por defecto: `laravel/config/cerebro.php`.

## Después de editar

| Cambiaste… | En tu PC | En el VPS |
|---|---|---|
| `laravel/.env` | Nada (recarga el navegador) | `docker compose restart` (la config queda cacheada con `optimize` al arrancar) |
| `knowledge/` | `docker compose exec app php artisan knowledge:sync` | Igual (o `docker compose restart`) |
| `.env` de Docker o `docker-compose*.yml` | `docker compose up -d` | `docker compose up -d` |
| `common/frankenphp/` | `docker compose up -d --build` | `docker compose up -d --build` |

Comprobar que la app ve los valores nuevos: `curl https://chat.tudominio.com/api/widget` (textos, chips,
calificación, links).

---

## `.env` de Docker (carpeta de la instancia)

| Variable | Dónde | Qué hace |
|---|---|---|
| `NAME` | Siempre | Nombre de los contenedores (`NAME` y `NAME-scheduler`). Usa el de la carpeta. |
| `DOMAIN` | VPS | Dominio público (`VIRTUAL_HOST`/`LETSENCRYPT_HOST` del nginx-proxy). |
| `EMAIL` | VPS | Email para el certificado HTTPS. |
| `COMPOSE_FILE` | VPS | `docker-compose.prod.yml`, para usar `docker compose` sin `-f`. En tu PC, comentada. |
| `UID` / `GID` | VPS | Dueño de los archivos (`id -u` / `id -g`). |
| `APP_PORT` | PC | Puerto local (ej. `81` → http://localhost:81). En producción no hay puertos propios. |

## `laravel/.env`

### Chat: lo que cambia de un negocio a otro

| Variable | Ejemplo | Qué hace |
|---|---|---|
| `CEREBRO_BUSINESS_NAME` | `"Aníbal Linux"` | Nombre en la cabecera y en el prompt del bot. |
| `CEREBRO_OWNER_NAME` | `"Aníbal"` | Quien atiende: "Que Aníbal me llame", tooltip de WhatsApp. Vacío = nombre del negocio. |
| `CEREBRO_WHATSAPP` | `51970142637` | Solo dígitos, con código de país. Vacío = sin botones de WhatsApp. |
| `CEREBRO_GREETING` | `"¡Hola! 👋 …"` | Primer mensaje del chat. |
| `CEREBRO_COLOR_ACCENT` | `"#1a73e8"` | Color del asistente (burbujas, chips, botón enviar). |
| `CEREBRO_TIMEZONE` | `America/Lima` | Zona del negocio (horarios de llamada). |

**Llamadas ("Que … me llame")**

| Variable | Ejemplo | Qué hace |
|---|---|---|
| `CEREBRO_CALL_DAYS` | `1-5` | Días (1 = lunes … 7 = domingo). También `"1,3,5"`. |
| `CEREBRO_CALL_HOURS` | `"11:00-12:00,15:00-16:00"` | Franjas, en la zona de `CEREBRO_TIMEZONE`. El visitante las ve en su hora local. |
| `CEREBRO_CALL_TIMEZONE_LABEL` | `"hora Perú"` | Texto junto a la hora del negocio. |
| `CEREBRO_CALL_COUNTRY_CODE` | `"+51"` | Código por defecto del teléfono si no se detecta el país. |
| `CEREBRO_CALL_INTRO` | `'Llamada rápida…'` | Texto del formulario (el bot también lo usa). Con `$`, comillas simples. |

**Chips y bienvenida**

| Variable | Ejemplo | Qué hace |
|---|---|---|
| `CEREBRO_LAUNCHER_TEXT` | `"¿Dudas? Pregúntame"` | Texto del botón flotante, junto al ícono de chat. Vacío = solo el ícono. |
| `CEREBRO_NUDGE` | `¿Tienes dudas? Te ayudo 👋` | Globito que invita junto a la burbuja cerrada (una vez por visita, sin sonido). Vacío = no sale. |
| `CEREBRO_NUDGE_DELAY` | `20` | Segundos en la página antes de mostrar el globito. |
| `CEREBRO_TOPICS_TITLE` | `"Lo más buscado"` | Título encima de los chips. |
| `CEREBRO_TOPIC_1` … `_8` | `"🐧 Aprender Linux \| Quiero aprender Linux \| respuestas/aprender-linux.md"` | `texto del botón \| mensaje que se envía \| respuesta escrita`. Con la 3.ª parte (un `.md` de `knowledge/`) responde **al instante y sin IA**; sin ella, responde Gemini (~6 s y gasta tokens). |
| `CEREBRO_RATING` | `"4.9"` | "★ 4.9 en Google" en la cabecera. Vacío = no se muestra. |
| `CEREBRO_RATING_SOURCE` | `Google` | Dónde está la calificación. |
| `CEREBRO_RATING_URL` | `https://maps.app.goo.gl/…` | Link a las reseñas (solo `http/https`). |
| `CEREBRO_LINKS` | `"blog\|https://blog…/\|Tutoriales y proyectos en mi blog"` | Link del dueño al pie de la bienvenida: `tipo\|url\|texto`. Mejor **uno solo**. Tipos con ícono: `blog`, `web`, `youtube`, `tiktok`, `facebook`, `instagram`, `linkedin`. Solo `http/https`. |

> ⚠️ Si un chip tarda varios segundos en producción, casi siempre le falta la 3.ª parte en el `laravel/.env`
> del VPS (o no existe ese `.md` en `knowledge/`).

### IA

| Variable | Ejemplo | Qué hace |
|---|---|---|
| `CEREBRO_LLM_PROVIDER` | `gemini` | Proveedor vía Prism: `gemini`, `groq`, `openrouter`, `deepseek`, `openai`, `anthropic`, `ollama`. |
| `CEREBRO_LLM_MODEL` | `gemini-3.6-flash` | Modelo principal. |
| `CEREBRO_LLM_FALLBACK_MODEL` | `gemini-3.5-flash-lite` | Respaldo si el principal falla antes de responder. |
| `CEREBRO_LLM_MAX_TOKENS` | `3000` | Tope por respuesta; **incluye lo que el modelo "piensa"**. Con menos de ~2000 se cortan respuestas. |
| `CEREBRO_LLM_THINKING` | `low` | Cuánto "piensa" Gemini (`minimal`, `low`, `medium`, `high`; vacío = lo del modelo). Lo pensado sale del tope de tokens: con más, la respuesta puede cortarse. |
| `GEMINI_API_KEY` | — | Clave del proveedor (la del cliente). Secreta. |
| `CEREBRO_KNOWLEDGE_EXCLUDE` | `"borrador.md,notas/x.md"` | Red de seguridad: archivos de `knowledge/` que el bot no debe leer. Lo interno no va en `knowledge/`. |

### Seguridad y límites

| Variable | Defecto | Qué hace |
|---|---|---|
| `CEREBRO_ALLOWED_ORIGINS` | `*` | Webs que pueden usar el widget (CORS), separadas por coma. **En producción, solo el dominio del cliente** (ej. `https://anibalcopitan.com`). |
| `CEREBRO_TRUSTED_PROXIES` | vacío | De quién se toma la IP real del visitante: `docker` (nginx-proxy), `cloudflare`. Tras Cloudflare: `docker,cloudflare`. Sin esto, el límite por IP ve a todos como la IP del proxy. |
| `CEREBRO_CHAT_PER_MINUTE` | `10` | Mensajes por IP por minuto. |
| `CEREBRO_CHAT_PER_DAY` | `100` | Mensajes por IP al día. |
| `CEREBRO_CHAT_GLOBAL_PER_DAY` | `1000` | Tope diario de toda la instancia (protege la factura de IA). |
| `CEREBRO_CALLS_PER_DAY` | `3` | Solicitudes de llamada por IP al día. |

### Datos (Ley 29733) y backups

| Variable | Defecto | Qué hace |
|---|---|---|
| `CEREBRO_RETENTION_CALLS_DAYS` | `90` | Días que se guardan las solicitudes de llamada (`data:prune`, 3:30 am). |
| `CEREBRO_RETENTION_CONVERSATIONS_DAYS` | `180` | Días que se guardan las conversaciones. |
| `CEREBRO_BACKUP_PATH` | `storage/app/backups` | Dónde guarda `db:backup` (3 am) la copia de SQLite. |
| `CEREBRO_BACKUP_KEEP` | `14` | Copias que se conservan. |

### Telegram (avisos de llamadas)

| Variable | Qué hace |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot (@BotFather). Secreto. |
| `TELEGRAM_CHAT_ID` | A quién le llegan los avisos. Varios separados por coma (ej. `8206633288,123456789`): cada cuenta debe tocar "Iniciar" en el bot. `php artisan telegram:setup` muestra los números y prueba cada uno. |

### Laravel (las que importan)

| Variable | PC | VPS |
|---|---|---|
| `APP_ENV` | `local` | `production` (también lo fija `docker-compose.prod.yml`; activa `php artisan optimize` al arrancar) |
| `APP_DEBUG` | `true` | **`false`** (si no, los errores muestran datos internos) |
| `APP_URL` | `http://localhost` | `https://chat.tudominio.com` |
| `APP_KEY` | Se genera sola al arrancar | **A mano, una vez**: `echo "base64:$(openssl rand -base64 32)"`. Sin ella el contenedor no arranca. No la cambies después (invalida lo cifrado). |
| `LOG_LEVEL` | `debug` | `warning` o `error` |

El resto (`DB_CONNECTION=sqlite`, `SESSION_DRIVER`, `CACHE_STORE`, `QUEUE_CONNECTION`) se deja como en el ejemplo.

## Checklist al desplegar o actualizar

1. `git pull` en el VPS.
2. Compara las variables: `diff <(grep -o '^[A-Z_]*' laravel/.env.example | sort) <(grep -o '^[A-Z_]*' laravel/.env | sort)`
   — lo que sale con `<` falta en tu `laravel/.env`.
3. `docker compose restart` (o `up -d --build` si cambió la imagen).
4. `curl https://chat.tudominio.com/api/widget` y prueba un chip: debe responder en menos de 1 s.
