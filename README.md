# 🧠 Cerebro OS · Infraestructura

Cómo se **levanta** Cerebro OS (Docker + despliegue). El backend vive aparte, en `project/<instancia>/laravel/` (su propio repo git).

```
app/                                   ← este repo
├── common/
│   ├── frankenphp/                    ← la imagen: PHP 8.4 + Caddy (targets dev / prod)
│   └── proxy/                         ← nginx-proxy + HTTPS (solo si el VPS no tiene otro proxy)
└── project/
    └── chat.anibalcopitan.com/        ← una carpeta por instancia (cliente)
        ├── docker-compose.yml         ← local
        ├── docker-compose.prod.yml    ← VPS: sin puertos, se publica por el proxy (red "red")
        ├── .env                       ← Docker: NAME, DOMAIN, EMAIL… (no se versiona)
        ├── laravel/                   ← repo del backend (no se versiona aquí)
        │   └── .env                   ← la app: keys de Gemini y Telegram, CORS…
        └── knowledge/                 ← repo + vault de Obsidian de ESTA instancia (no se versiona aquí)
```

Dos `.env` distintos: **`.env` de la instancia = Docker**, **`laravel/.env` = la app**.
🔒 **`knowledge/` = solo lo público**: el bot puede revelar cualquier cosa que esté ahí. Notas internas, costos o datos de clientes van fuera (ej. `~/sites/obsidian-vault/cerebro-os`). Ábrelo en Obsidian con "Open folder as vault".
Contenedores con nombre legible (`NAME`): `chat.anibalcopitan.com` (web) y `chat.anibalcopitan.com-scheduler` (tareas).

Cómo funciona por dentro (contenedores, scheduler, datos): **`ARQUITECTURA.md`**.

## Local

```bash
cd project/chat.anibalcopitan.com
cp .env.example .env           # NAME y puerto
docker compose up -d --build   # http://localhost:8000/demo.html
docker compose exec app php artisan test
```

Dos contenedores con la misma imagen y el mismo código: `app` (web) y `scheduler` (recordatorios, backup diario 3 am y borrado de datos vencidos).

## Producción (manual, con git)

Cerebro **no abre puertos**: se publica a través de un **nginx-proxy en la red `red`** (lo detecta por `VIRTUAL_HOST` y saca el HTTPS con `LETSENCRYPT_HOST`). En el VPS de rapitaller se usa el proxy que ya existe, **sin tocarlo**; en un VPS sin proxy: `cd common/proxy && docker compose up -d`.

**Una sola vez:**
1. DNS: registro `A` del subdominio → IP del VPS. Si pasa por Cloudflare (nube naranja), pon `CEREBRO_TRUSTED_PROXIES=docker,cloudflare` en `laravel/.env`.
2. En el VPS, una **deploy key de solo lectura** para los tres repos privados (infra, backend, conocimiento):
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/cerebro_deploy -N ""   # la .pub va en GitHub → repo → Settings → Deploy keys
   ```
3. Clonar con la misma estructura que en el PC:
   ```bash
   git clone git@github.com:USUARIO/cerebro-os-infra.git ~/cerebro-os
   git clone git@github.com:USUARIO/cerebro-os.git ~/cerebro-os/project/chat.anibalcopitan.com/laravel
   git clone git@github.com:USUARIO/knowledge-anibalcopitan.git ~/cerebro-os/project/chat.anibalcopitan.com/knowledge
   ```
4. Crear los dos `.env` en `~/cerebro-os/project/chat.anibalcopitan.com/` (`chmod 600`):
   - `.env` → `NAME`, `DOMAIN`, `EMAIL`, `COMPOSE_FILE=docker-compose.prod.yml` (y `UID`/`GID` si no son 1000)
   - `laravel/.env` → desde `laravel/.env.production.example` (keys reales; `APP_KEY`: `echo "base64:$(openssl rand -base64 32)"`)
5. Levantar y comprobar:
   ```bash
   docker ps --filter name=nginx_proxy && docker network ls | grep red   # el proxy existe
   docker compose up -d --build && docker compose logs -f app
   curl -I https://chat.anibalcopitan.com/up
   ```

**Cada vez (en el VPS, carpeta de la instancia):**

| Cambio | Comando |
|---|---|
| Código (backend) | `git -C laravel pull && docker compose restart` |
| Docker (imagen o compose) | `git pull && docker compose up -d --build` |
| Conocimiento (Obsidian) | `git -C knowledge pull && docker compose exec app php artisan knowledge:sync` |
| Logs | `docker compose logs -f app` |
| Backup a tu PC | `scp USUARIO@IP:~/cerebro-os/project/chat.anibalcopitan.com/laravel/storage/app/backups/* ~/sites/cerebro-os/database/` |

Al arrancar, el contenedor corre `composer install`, migraciones y recachea la config: para cambios de código basta `restart`.
Lo único compartido con rapitaller es la puerta de entrada (el proxy). Nunca corras `docker system prune --volumes` en un VPS compartido.

### Mudarse a otro VPS
1. Copiar a tu PC el último backup (`scp` de arriba).
2. En el VPS nuevo: pasos 2–5 (si no tiene proxy, levantar `common/proxy`).
3. `docker compose stop`, copiar el backup a `laravel/database/database.sqlite`, `docker compose start`.
4. Apuntar el DNS a la IP nueva. 🔒 Rota las keys de Gemini y Telegram si el VPS anterior era compartido.

## Nuevo cliente

```bash
cp -r project/chat.anibalcopitan.com project/chat.cliente.com   # sin laravel/, knowledge/ ni .env
git clone <repo-backend> project/chat.cliente.com/laravel
mkdir project/chat.cliente.com/knowledge && git -C project/chat.cliente.com/knowledge init   # su vault, su repo
```

En su `.env`: `NAME`/`DOMAIN` = `chat.cliente.com`. En su `laravel/.env`: sus keys. Comparte el proxy del VPS con las demás instancias.
