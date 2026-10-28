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
| Conectar avisos de Telegram | `docker compose exec app php artisan telegram:setup` |

**Widget en tu web** (antes de `</body>`):

```html
<script src="https://chat.anibalcopitan.com/widget.js" defer></script>
```

Saludo, colores (`colors`, estilo sobrio tipo Google: azul `#1a73e8` = asistente, verde `#188038` = WhatsApp, cabecera blanca), WhatsApp, botón **"Ya decidí, quiero pagar"** y **chips de temas** se editan en `config/cerebro.php` → `widget` (lo sirve `GET /api/widget`).

## Cómo funciona

```
web estática ──widget.js──▶ POST /api/chat (SSE) ──▶ Prism ──▶ LLM
                                 │                    ▲
                                 ▼                    │ system prompt = resources/prompts/sistema.md
                          SQLite (conversations,      │               + knowledge/*.md compilado
                                  messages)           │ (excluye CEREBRO_KNOWLEDGE_EXCLUDE)
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

## Producción (VPS DigitalOcean)

FrankenPHP (Caddy) sirve la app y saca el HTTPS solo. No hace falta nginx ni certbot.

**Una sola vez:**
1. Droplet Ubuntu 24.04 (1 GB) con tu **llave SSH** (sin contraseña).
2. DNS: registro `A` `chat` → IP del droplet. En Cloudflare, **nube gris** ("DNS only"): así Caddy saca el certificado y el límite por IP ve la IP real.
3. En el servidor (como root):
   ```bash
   apt update && apt -y upgrade && apt -y install docker.io docker-compose-v2 unattended-upgrades
   adduser --disabled-password deploy && usermod -aG docker deploy
   mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy: /home/deploy/.ssh
   sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/; s/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config && systemctl restart ssh
   ufw allow OpenSSH && ufw allow 80,443/tcp && ufw allow 443/udp && ufw --force enable
   ```
4. `mkdir ~/cerebro-os` como `deploy` y crea `~/cerebro-os/.env` desde `.env.production.example` (keys reales, `chmod 600`).
5. En tu PC, en tu `.env` local: `DEPLOY_HOST=deploy@IP`.

**Cada vez:**

| Qué | Comando (desde tu PC) |
|---|---|
| Subir cambios de código | `./deploy.sh` |
| Subir cambios de Obsidian | `./deploy.sh knowledge` |
| Bajar backups de SQLite a `~/sites/cerebro-os/database/` | `./deploy.sh backup` |
| Ver logs | `./deploy.sh logs` |

- `oportunidades.md` y lo de `CEREBRO_KNOWLEDGE_EXCLUDE` **nunca salen de tu PC**.
- Backups automáticos todos los días a las 3 am (se guardan 14). Los datos personales se borran solos: llamadas a los 90 días y conversaciones a los 180 (`data:prune`).

## Dónde vive

```
~/sites/cerebro-os/
├── app/
│   ├── common/                      ← infraestructura compartida del VPS (proxy), cuando haya 2+ instancias
│   └── project/
│       ├── cerebro-os/              ← este repo: el producto (aquí se desarrolla)
│       └── chat.<dominio>/          ← una instancia por cliente: docker-compose + .env + datos (Fase 1.5)
├── database/                        ← backups de SQLite
└── data/                            ← capturas, videos, documentos
```

## Plan

### Fase 1 — MVP del chat web
- [x] Proyecto Laravel + SQLite dockerizado (FrankenPHP, 1 contenedor)
- [x] `knowledge:sync`: vault de Obsidian → prompt (excluye archivos internos)
- [x] `POST /api/chat` con streaming SSE, historial y guardado de conversaciones
- [x] Proveedor de IA configurable por `.env` (Prism)
- [x] `widget.js` embebible + botón WhatsApp + modo oscuro
- [x] Mobile first: pantalla completa en el celular, se adapta al teclado, sin zoom de iPhone, márgenes para notch y botones táctiles de 40px+
- [ ] Probar en celulares reales (iPhone Safari y Android Chrome)
- [x] Botón ↻ "Nueva conversación" + reinicio automático tras 24 h sin actividad + widget sin caché
- [x] "📞 Que Aníbal me llame": formulario en el chat con franjas libres (y hora local del visitante), aviso por Telegram y recordatorio
- [x] Horarios para todo el mundo: hora local del visitante primero (hora Perú debajo), "en 17 h", aviso 🌙 de madrugada, código de país automático y hora del cliente en Telegram
- [ ] Crear el bot de Telegram y poner `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` (`php artisan telegram:setup`)
- [x] Bienvenida con 2 caminos: "Ya decidí, quiero pagar" (WhatsApp directo) y chips de temas que preguntan al asistente
- [x] CORS y rate limit por IP · tests automáticos
- [x] Probado con API key real de Gemini (`gemini-3.6-flash` + respaldo `gemini-3.5-flash-lite`)
- [ ] Ajustar tono/prompt con conversaciones reales
- [ ] Pegar el widget en `/linktree` y en la web

### Fase 1.5 — Producción segura
- [x] Imagen de producción (código dentro, sin dependencias de dev, `php.ini` de producción) + `docker-compose.prod.yml`
- [x] `.env.production.example`: `APP_DEBUG=false`, CORS solo para anibalcopitan.com
- [x] Cabeceras de seguridad (HSTS, nosniff, sin `Server`) y logs rotados
- [x] Backup diario de SQLite (`db:backup`, 14 copias) + `./deploy.sh backup` a tu PC
- [x] Aviso de privacidad en el formulario de llamada + borrado automático (`data:prune`) + logs sin teléfonos
- [x] `./deploy.sh` (rsync por SSH, sin GitHub) · `composer audit` sin vulnerabilidades
- [ ] Crear droplet, DNS `chat.anibalcopitan.com` y primer despliegue
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
- [ ] Instalador (`install.sh`) + plantilla de conocimiento para clientes
- [ ] Guía de instalación por cliente (Plan Implementación)

### Fase 5 — Cuando haga falta
- [ ] Canal WhatsApp (Cloud API / Evolution API)
- [ ] RAG con `sqlite-vec` para bases de conocimiento grandes
