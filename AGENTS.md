# Cerebro OS — contexto del proyecto

Chat con IA embebible (widget JS) que responde con el conocimiento del dueño (vault de Obsidian en `.md`) y agenda llamadas. Primer cliente: Aníbal Linux (anibalcopitan.com, sitio estático). Plan detallado: `project/chat.rapitaller.com/laravel/README.md` (fases con checkboxes). Este archivo resume decisiones, estado y pendientes: **actualízalo al terminar cada tarea**.

Arquitectura técnica (contenedores, scheduler, flujo, datos): `ARQUITECTURA.md`. Seguridad (riesgos, aplicado, pendiente): `SEGURIDAD.md`. Variables de los dos `.env` y qué hacer tras editarlos: `CONFIGURACION.md`.

## Decisiones (no re-discutir)
- Stack: Laravel 13 · PHP 8.4 · SQLite · FrankenPHP (Docker) · Prism PHP (Gemini `gemini-3.6-flash` + respaldo `gemini-3.5-flash-lite`) · SSE.
- Sin RAG: todo el conocimiento (~19k tokens) va en el system prompt (`knowledge:sync`). RAG con sqlite-vec solo si no cabe.
- Canal web primero; WhatsApp después. Avisos a Aníbal por Telegram (solo salida, sin webhook).
- Llamadas: lun–vie 11–12 y 15–16 hora Perú; franjas en UTC; el widget muestra la hora local del visitante.
- Git: **todo en `master`**, sin ramas de feature. Commits en español.
- Modelo de negocio: sin SaaS. Una instancia aislada por empresa (hospedada en el VPS de Aníbal o self-hosted), migrable y bifurcable (ver Fase 4).

## Un solo repo (Docker separado del backend por carpetas, estilo rapitaller)
```
~/sites/cerebro-os/app/                     ← repo único
├── common/frankenphp/                      imagen (targets dev/prod) + entrypoint
├── common/proxy/                           nginx-proxy + acme-companion propio (solo si el VPS no tiene proxy)
└── project/chat.rapitaller.com/            instancia: docker-compose(.prod).yml, .env (Docker)
    ├── laravel/                            ← backend
    └── knowledge/                          ← vault de Obsidian de la instancia
```
- `.env` de la instancia = Docker (`NAME`, `DOMAIN`, `EMAIL`, `COMPOSE_FILE` en el VPS). `laravel/.env` = la app (keys, CORS, límites) y la sección **Chat** (nombre, quien atiende, WhatsApp, saludo, horarios, chips).
- `laravel/` debe ser idéntica en todas las instancias: nada propio de un negocio en el código (va en `laravel/.env` o en `knowledge/`). Nueva instancia: `NUEVA-INSTANCIA.md`.
- Contenedores: `chat.rapitaller.com` (web) y `chat.rapitaller.com-scheduler` (`schedule:work`: recordatorios cada minuto, `db:backup` 3 am, `data:prune` 3:30 am).
- Comandos: desde la carpeta de la instancia, `docker compose exec app php artisan test`. Mantener los tests en verde.
- Conocimiento: `knowledge/` de cada instancia = vault de Obsidian, montado solo lectura. **Solo contenido público** (el bot puede revelarlo). Lo interno (ej. `oportunidades.md`) vive en `~/sites/obsidian-vault/cerebro-os`, nunca en `knowledge/`.

## Producción
- Sin puertos propios: se publica por un nginx-proxy en la red `red` (`VIRTUAL_HOST`/`LETSENCRYPT_HOST`). En el VPS de rapitaller se usa su proxy; en un VPS sin proxy se levanta `common/proxy`.
- Despliegue **manual con git** (un repo privado + una deploy key de solo lectura; ver README). Sin scripts de deploy en la primera fase: no reintroducirlos sin pedirlo.
- Hoy: VPS compartido con rapitaller (temporal, para ahorrar) → luego VPS exclusivo. Requisito: proyectos aislados, sin dependencias entre ellos, y migrar sin cambiar archivos.
- `CEREBRO_TRUSTED_PROXIES` (`docker`, `cloudflare`) para que el límite por IP use la IP real.
- Pendiente: primer despliegue y DNS del subdominio.

## Seguridad y privacidad (Ley 29733)
- Producción: `APP_DEBUG=false`, CORS solo para el dominio del cliente, rate limit por IP, honeypot en formularios.
- Datos personales: aviso en el formulario, retención (llamadas 90 días, conversaciones 180), logs sin teléfonos.
- Nunca versionar `.env`, bases SQLite ni backups.
- Bot sin herramientas y con contexto público: si lo engañan, que no pase nada grave. Prompt con alcance cerrado y anti-inyección; tope global diario. Pendientes en `SEGURIDAD.md`.

## Estilo
- Respuestas y documentación en español, claras y breves. Código que imite el estilo existente (comentarios cortos en español).
- Widget: vanilla JS en Shadow DOM, mobile-first; paleta sobria tipo Google (azul `#1a73e8` = asistente, verde `#188038` solo WhatsApp).
- Antes de cambios grandes, proponer un plan y esperar el ok del usuario.

## Estado (actualizado 2026-11-02)

**Hecho**
- Fase 1 (MVP): chat con streaming, conocimiento de Obsidian, widget mobile-first (Shadow DOM), botón "quiero pagar", chips de temas, "📞 Que Aníbal me llame" con hora local del visitante, avisos y recordatorios por Telegram (bot configurado).
- Fase 1.5 (producción): imagen prod, `docker-compose.prod.yml` sin puertos vía nginx-proxy, proxy propio en `common/proxy`, backups diarios, retención de datos, aviso de privacidad, IP real tras proxy/Cloudflare, cabeceras de seguridad. 28 tests en verde.
- Instancia única: `project/chat.rapitaller.com` (se eliminó `chat.anibalcopitan.com` por simplicidad; hay un zip de respaldo fuera del repo). Su contenido todavía es el de Aníbal Linux.
- Repo único con Docker, backend (`laravel/`) y conocimiento (`knowledge/`, vault de Obsidian); nombres de contenedor legibles.
- Chips con respuesta escrita (tercer campo de `CEREBRO_TOPIC_*` → `knowledge/respuestas/*.md`): sin IA ni tokens. `CEREBRO_LLM_MAX_TOKENS=3000` (el "pensamiento" de Gemini cuenta en el tope; con 800 se cortaban respuestas).
- Fase 4 definida en el README (niveles hospedado / widget / self-hosted).
- Widget (2026-11-03): "Nueva conversación" destacada en azul; título de chips configurable (`CEREBRO_TOPICS_TITLE`, "Lo más buscado"); calificación "★ 4.9 en Google" en la cabecera (`CEREBRO_RATING*`); aviso de IA al pie bajo el campo de texto; un solo link del dueño al pie de la bienvenida: el blog (`CEREBRO_LINKS="tipo|url|texto"`, solo http/https). Sin link a anibalcopitan.com ni al linktree: el widget vive ahí. Botón de WhatsApp con logo. 29 tests en verde.
- Raíz `/` = página del visitante (`public/chat.html`) con el chat abierto (`data-open` en el `<script>`); el código para pegar va oculto tras un "Saber más" que lo muestra sin mover nada (y en los README). Un link `<a href="#chat">` o entrar con `#chat` abre el widget (para el linktree, que usa la burbuja cerrada). (2026-11-03)
- Botón flotante en píldora: ícono de chat (SVG, ya no emoji) + texto `CEREBRO_LAUNCHER_TEXT` ("¿Dudas? Pregúntame"; vacío = solo ícono); abierto, círculo con ✕. 30 tests en verde. (2026-11-03)
- "Que Aníbal me llame" sin barra fija abajo: ícono de teléfono (SVG) en la cabecera + chip dentro de la conversación (una vez tras la 2.ª respuesta y cuando el bot sugiere la llamada; se guarda en el mensaje con `call: true`). Con calificación, la cabecera ya no muestra "En línea". (2026-11-03)
- Vault revisado (2026-11-03): precios unificados (Android SaaS S/49; AppMonetizable $10 solo código, sin soporte), planes viejos eliminados, estrategia interna movida a `~/sites/obsidian-vault/cerebro-os/estrategia-ventas.md`, caso Studio8Record anonimizado, wikilinks corregidos.

- Nueva instancia en preparación: `project/sonidos.rapitaller.com` (Sonidos Especiales, Luciva360: canciones, jingles, perifoneos). Por ahora solo `knowledge/`, reordenado al formato de Cerebro (bot vendedor que toma pedidos: guía con flujo de pedido, 5 servicios, 8 respuestas de chips). El material original (widget sin IA, prompt n8n, integraciones) está en `referencia/`, fuera del prompt; la sección Chat sugerida está en `referencia/env-chat.md`. Falta crear Docker, `.env` y `laravel/`. (2026-11-04)
- Respuestas cortadas (2026-11-05): `CEREBRO_LLM_THINKING=low` limita el pensamiento de Gemini (salía del tope de tokens y cortaba frases). Si igual se corta (tokens o filtro de seguridad), se cierra con un aviso amable y queda `Respuesta cortada` en el log; si no llegó texto, se usa el modelo de respaldo. 32 tests en verde.
- Ver conversaciones por terminal (2026-11-05): `php artisan chat:ver` (últimas; `--n=50`, `--buscar=texto`) y `chat:ver <#>` (una completa, hora Perú). Sin panel web por ahora. 33 tests en verde.

**Siguiente**
1. Primer despliegue en el VPS de rapitaller (manual con git): repo privado `cerebro-os` en GitHub, DNS del subdominio, clonar, crear los dos `.env`, `docker compose up -d --build`.
2. Pegar el widget en anibalcopitan.com/linktree (burbuja + botón `<a href="#chat">💬 Pregúntale a mi asistente</a>`), poner `https://anibalcopitan.com` en `CEREBRO_ALLOWED_ORIGINS`; probar en celulares reales.

**Pendiente**
- Fase 1: ajustar tono/prompt con conversaciones reales. Revisar los borradores de `knowledge/respuestas/`.
- Fase 1.5: página de política de privacidad (Ley 29733) enlazada desde el aviso.
- Fase 2: CRM con Filament en `/admin` (conversaciones, llamadas con estados, contactos con etapas, tool `guardar_lead`, métricas). Panel con 2FA, límite de intentos y, si se puede, Cloudflare Access.
- Fase 3: webhooks → n8n.
- Fase 4: separar el producto del repo único (`git subtree split`), chat a pantalla completa en `/`, DNS comodín + script de nueva instancia, versiones + CHANGELOG, licencia, contratos.
- Fuera de alcance (no tocar sin ok): proxy de rapitaller con versiones de 2022 y `common/.env_example` con contraseñas reales.

