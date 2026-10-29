# 🧠 Cerebro OS

Chat con IA para tu web que responde con **tu propio conocimiento** (carpeta `.md` de Obsidian) y guarda cada conversación en un **CRM ligero**. Se instala **una instancia por cliente** (ver repo de infraestructura).

**Stack:** Laravel 13 · SQLite · FrankenPHP (Docker) · Prism PHP (Gemini por defecto; cambiable a Groq, OpenRouter, DeepSeek, OpenAI, Claude u Ollama) · SSE para streaming.

## Arranque rápido

Este repo es **solo el backend**. Docker vive afuera, en el repo de infraestructura (`../` = la instancia, `../../../common/frankenphp` = la imagen):

```bash
cd ..                     # carpeta de la instancia (ej. chat.anibalcopitan.com)
cp .env.example .env      # Docker: nombre y puerto (el conocimiento está en ../knowledge)
docker compose up -d --build
xdg-open http://localhost:8000/demo.html
```

El contenedor instala dependencias, crea `laravel/.env` y la base SQLite, migra y compila el conocimiento. Pon `GEMINI_API_KEY` (gratis en https://aistudio.google.com/apikey) en `laravel/.env`.

## Uso diario (desde la carpeta de la instancia)

| Acción | Comando |
|---|---|
| Recargar conocimiento tras editar Obsidian | `docker compose exec app php artisan knowledge:sync` |
| Tests | `docker compose exec app php artisan test` |
| Logs | `docker compose logs -f app` |
| Conectar avisos de Telegram | `docker compose exec app php artisan telegram:setup` |
| Producción | ver `README.md` de la infraestructura (despliegue manual con git) |

**Widget en tu web** (antes de `</body>`):

```html
<script src="https://chat.anibalcopitan.com/widget.js" defer></script>
```

Saludo, colores (`colors`, estilo sobrio tipo Google: azul `#1a73e8` = asistente, verde `#188038` = WhatsApp, cabecera blanca), WhatsApp, botón **"Ya decidí, quiero pagar"** y **chips de temas** se editan en `config/cerebro.php` → `widget` (lo sirve `GET /api/widget`).

## Cómo funciona

Arquitectura completa (contenedores, scheduler, datos, despliegue): `ARQUITECTURA.md` en el repo de infraestructura.

```
web estática ──widget.js──▶ POST /api/chat (SSE) ──▶ Prism ──▶ LLM
                                 │                    ▲
                                 ▼                    │ system prompt = resources/prompts/sistema.md
                          SQLite (conversations,      │               + knowledge/*.md compilado
                                  messages)           │ (vault ../knowledge)
```

- **Sin RAG por ahora:** todo el conocimiento (~19k tokens) va en el prompt. RAG solo cuando no quepa.
- **"Que Aníbal me llame":** el visitante deja nombre, WhatsApp y proyecto, y elige una de las 3 próximas franjas (lun–vie 11–12 y 3–4 pm, hora Perú; editable en `config/cerebro.php` → `calls`). Llega un aviso por Telegram y un recordatorio 5 min antes de la franja (servicio `scheduler`).
- **Protección:** CORS (`CEREBRO_ALLOWED_ORIGINS`) + límite por IP por minuto y por día.

| Archivo | Qué es |
|---|---|
| `config/cerebro.php` | Toda la configuración del producto |
| `app/Services/Knowledge.php` | Compila el conocimiento y arma el system prompt |
| `app/Http/Controllers/ChatController.php` | Endpoint del chat con streaming |
| `app/Services/CallSlots.php` | Calcula las franjas libres para llamadas |
| `public/widget.js` | Widget embebible (sin dependencias); su contenido viene de `GET /api/widget` |

## Plan

### Fase 1 — MVP del chat web
- [x] Proyecto Laravel + SQLite dockerizado (FrankenPHP)
- [x] `knowledge:sync`: vault de Obsidian → prompt (excluye archivos internos)
- [x] `POST /api/chat` con streaming SSE, historial y guardado de conversaciones
- [x] Proveedor de IA configurable por `.env` (Prism)
- [x] `widget.js` embebible + botón WhatsApp + modo oscuro
- [x] Mobile first: pantalla completa en el celular, se adapta al teclado, sin zoom de iPhone, márgenes para notch y botones táctiles de 40px+
- [ ] Probar en celulares reales (iPhone Safari y Android Chrome)
- [x] Botón ↻ "Nueva conversación" + reinicio automático tras 24 h sin actividad + widget sin caché
- [x] "📞 Que Aníbal me llame": formulario en el chat con franjas libres (y hora local del visitante), aviso por Telegram y recordatorio
- [x] Horarios para todo el mundo: hora local del visitante primero (hora Perú debajo), "en 17 h", aviso 🌙 de madrugada, código de país automático y hora del cliente en Telegram
- [x] Crear el bot de Telegram y poner `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` (`php artisan telegram:setup`)
- [x] Bienvenida con 2 caminos: "Ya decidí, quiero pagar" (WhatsApp directo) y chips de temas que preguntan al asistente
- [x] CORS y rate limit por IP · tests automáticos
- [x] Probado con API key real de Gemini (`gemini-3.6-flash` + respaldo `gemini-3.5-flash-lite`)
- [ ] Ajustar tono/prompt con conversaciones reales
- [ ] Pegar el widget en `/linktree` y en la web

### Fase 1.5 — Producción segura
- [x] Docker separado del backend (repo de infraestructura): imagen en `common/frankenphp`, compose por instancia
- [x] Producción sin dependencias de dev, `php.ini` de producción + `docker-compose.prod.yml`
- [x] `.env.production.example`: `APP_DEBUG=false`, CORS solo para anibalcopitan.com
- [x] Cabeceras de seguridad (HSTS, nosniff, sin `Server`) y logs rotados
- [x] Backup diario de SQLite (`db:backup`, 14 copias)
- [x] Aviso de privacidad en el formulario de llamada + borrado automático (`data:prune`) + logs sin teléfonos
- [x] `composer audit` sin vulnerabilidades
- [x] Publicación por nginx-proxy (el del VPS o el propio de Cerebro), contenedores con nombre legible, sin puertos propios
- [x] IP real del visitante detrás de proxy/Cloudflare (`CEREBRO_TRUSTED_PROXIES`) · widget funciona en subdominio o carpeta
- [ ] Repos privados en GitHub + primer despliegue manual (VPS compartido con rapitaller) + DNS del subdominio
- [ ] Página de política de privacidad (Ley 29733) enlazada desde el aviso

### Fase 2 — CRM mínimo
- [ ] Panel admin con Filament (login, conversaciones, leads)
- [ ] Panel de llamadas solicitadas (marcar hecha / no contestó)
- [ ] Tabla `contacts` + etapas (nuevo → calificado → consulta $20 → plan → pagó)
- [ ] Tool del LLM `guardar_lead` (nombre, WhatsApp, interés, etapa)
- [ ] Tiempo real en el panel con Laravel Reverb
- [ ] Métricas: clics en "quiero pagar" vs. chips (qué temas venden)

### Fase 3 — Automatizaciones (n8n)
- [ ] Webhooks `lead.created` / `lead.hot` → n8n (aviso WhatsApp/Telegram, seguimientos, Sheets)

### Fase 4 — Producto vendible
Modelo: sin SaaS. Cada empresa tiene su instancia aislada (código, datos y conocimiento propios) y puede migrarla cuando quiera.

**Niveles**
1. Hospedado: `chat-cliente.anibalcopitan.com` (solo comparte la URL)
2. Hospedado + widget: una línea de JS en su web
3. Self-hosted: su servidor, su código (bifurcable; `git pull` del producto cuando quiera)

**Antes del primer cliente**
- [ ] Producto genérico: sacar la marca "Aníbal" del código; chat.anibalcopitan.com pasa a ser un cliente más
- [ ] Separar núcleo (no se toca) de personalización (.env, textos, colores, prompt, conocimiento) → `git pull` sin conflictos
- [ ] Página de chat a pantalla completa en `/` (nivel 1)
- [ ] DNS comodín `*.anibalcopitan.com` y script para crear una instancia nueva
- [ ] Versiones (`v1.x`) + CHANGELOG que marque 🔒 seguridad
- [ ] Cada empresa con su propia API key de pago (el plan gratis de Gemini puede usar los datos para entrenar)
- [ ] Licencia por instalación (usar y modificar, no redistribuir)
- [ ] Contrato: encargo de datos (Ley 29733) si es hospedado; quién responde si no actualiza si es self-hosted
- [ ] Planes: implementación + conocimiento curado + hosting/mantenimiento mensual opcional

### Fase 5 — Cuando haga falta
- [ ] Canal WhatsApp (Cloud API / Evolution API)
- [ ] RAG con `sqlite-vec` para bases de conocimiento grandes
