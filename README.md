# 🧠 Cerebro OS

Chat con IA para tu web que responde con **tu propio conocimiento** (carpeta `.md` de Obsidian) y guarda cada conversación en un **CRM ligero**. Se instala **una instancia por cliente**: carpeta + `.env` + `docker compose up`.

**Stack:** Laravel 13 · SQLite · FrankenPHP (Docker) · Prism PHP (Gemini por defecto; cambiable a Groq, OpenRouter, DeepSeek, OpenAI, Claude u Ollama) · SSE para streaming.

## Arranque rápido

```bash
cp .env.example .env      # pon GEMINI_API_KEY (gratis en https://aistudio.google.com/apikey) y KNOWLEDGE_PATH
docker compose up -d --build
xdg-open http://localhost:8000/demo.html   # o ábrelo en el navegador
```

El contenedor instala dependencias, crea la base SQLite, migra y compila el conocimiento al arrancar.

## Uso diario

| Acción | Comando |
|---|---|
| Recargar conocimiento tras editar Obsidian | `docker compose exec app php artisan knowledge:sync` |
| Tests | `docker compose exec app php artisan test` |
| Logs | `docker compose logs -f app` |

**Widget en tu web** (antes de `</body>`):

```html
<script src="https://chat.anibalcopitan.com/widget.js"
        data-title="Aníbal Linux" data-whatsapp="51970142637"
        data-greeting="¡Hola! 👋 ¿En qué te ayudo?" data-color="#16a34a" defer></script>
```

## Cómo funciona

```
web estática ──widget.js──▶ POST /api/chat (SSE) ──▶ Prism ──▶ LLM
                                 │                    ▲
                                 ▼                    │ system prompt = resources/prompts/sistema.md
                          SQLite (conversations,      │               + knowledge/*.md compilado
                                  messages)           │ (excluye CEREBRO_KNOWLEDGE_EXCLUDE)
```

- **Sin RAG por ahora:** todo el conocimiento (~19k tokens) va en el prompt. RAG solo cuando no quepa.
- **Protección:** CORS (`CEREBRO_ALLOWED_ORIGINS`) + límite por IP por minuto y por día.

| Archivo | Qué es |
|---|---|
| `config/cerebro.php` | Toda la configuración del producto |
| `app/Services/Knowledge.php` | Compila el conocimiento y arma el system prompt |
| `app/Http/Controllers/ChatController.php` | Endpoint del chat con streaming |
| `public/widget.js` | Widget embebible (sin dependencias) |

## Plan

### Fase 1 — MVP del chat web
- [x] Proyecto Laravel + SQLite dockerizado (FrankenPHP, 1 contenedor)
- [x] `knowledge:sync`: vault de Obsidian → prompt (excluye archivos internos)
- [x] `POST /api/chat` con streaming SSE, historial y guardado de conversaciones
- [x] Proveedor de IA configurable por `.env` (Prism)
- [x] `widget.js` embebible + botón WhatsApp + modo oscuro + móvil
- [x] CORS y rate limit por IP · tests automáticos
- [x] Probado con API key real de Gemini (`gemini-3.6-flash` + respaldo `gemini-3.5-flash-lite`)
- [ ] Ajustar tono/prompt con conversaciones reales
- [ ] Desplegar en `chat.anibalcopitan.com` (VPS o VPS en casa + Cloudflare Tunnel)
- [ ] Pegar el widget en `/linktree` y en la web

### Fase 2 — CRM mínimo
- [ ] Panel admin con Filament (login, conversaciones, leads)
- [ ] Tabla `contacts` + etapas (nuevo → calificado → consulta $20 → plan → pagó)
- [ ] Tool del LLM `guardar_lead` (nombre, WhatsApp, interés, etapa)
- [ ] Tiempo real en el panel con Laravel Reverb

### Fase 3 — Automatizaciones (n8n)
- [ ] Webhooks `lead.created` / `lead.hot` → n8n (aviso WhatsApp/Telegram, seguimientos, Sheets)

### Fase 4 — Producto vendible
- [ ] Instalador (`install.sh`) + plantilla de conocimiento para clientes
- [ ] Guía de instalación por cliente (Plan Implementación)

### Fase 5 — Cuando haga falta
- [ ] Canal WhatsApp (Cloud API / Evolution API)
- [ ] RAG con `sqlite-vec` para bases de conocimiento grandes
