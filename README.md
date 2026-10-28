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
        ├── deploy.sh                  ← sube al VPS por SSH
        └── laravel/                   ← repo del backend (no se versiona aquí)
            └── .env                   ← la app: keys de Gemini y Telegram, CORS…
```

Dos `.env` distintos: **`.env` de la instancia = Docker**, **`laravel/.env` = la app**.
Contenedores con nombre legible (`NAME`): `chat.anibalcopitan.com` (web) y `chat.anibalcopitan.com-scheduler` (tareas).

## Local

```bash
cd project/chat.anibalcopitan.com
cp .env.example .env           # KNOWLEDGE_PATH = tu vault de Obsidian
docker compose up -d --build   # http://localhost:8000/demo.html
docker compose exec app php artisan test
```

Dos contenedores con la misma imagen y el mismo código: `app` (web) y `scheduler` (recordatorios, backup diario 3 am y borrado de datos vencidos).

## Producción

Cerebro **no abre puertos**: se publica a través de un **nginx-proxy en la red `red`** (detecta el contenedor por `VIRTUAL_HOST` y saca el HTTPS con `LETSENCRYPT_HOST`). El mismo `docker-compose.prod.yml` sirve en cualquier VPS; `./deploy.sh` decide el proxy:

| VPS | Proxy | Qué haces |
|---|---|---|
| Compartido (ej. el de rapitaller) | Usa el que ya existe, **sin tocarlo** | `./deploy.sh` |
| Exclusivo / nuevo | Levanta `common/proxy` de Cerebro (solo si nadie usa el puerto 80) | `./deploy.sh` |

Lo único compartido en un VPS compartido es la puerta de entrada: contenedores, red interna, datos y backups son propios. Nunca corras `docker system prune --volumes` en un VPS compartido.

**Una sola vez por VPS:**
1. DNS: registro `A` de tu subdominio → IP del VPS. Si pasa por Cloudflare (nube naranja), pon `CEREBRO_TRUSTED_PROXIES=docker,cloudflare` en `laravel/.env`.
2. VPS nuevo, como root (en uno existente, solo lo que falte):
   ```bash
   apt update && apt -y upgrade && apt -y install docker.io docker-compose-v2 unattended-upgrades rsync
   adduser --disabled-password --gecos "" deploy && usermod -aG docker deploy
   mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy: /home/deploy/.ssh
   sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/; s/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config && systemctl restart ssh
   ufw allow OpenSSH && ufw allow 80,443/tcp && ufw --force enable
   ```
3. Como `deploy`, crea los dos `.env` (`chmod 600`) en `~/cerebro-os/project/chat.anibalcopitan.com/`:
   - `.env` → `NAME`, `DOMAIN`, `EMAIL` y `UID`/`GID` (`id -u`/`id -g`)
   - `laravel/.env` → desde `laravel/.env.production.example` (keys reales, `APP_KEY`)
4. En tu PC, en el `.env` de la instancia: `DEPLOY_HOST=deploy@IP`.

**Cada vez (desde la carpeta de la instancia en tu PC):**

| Qué | Comando |
|---|---|
| Subir cambios (imagen, compose, código, conocimiento) | `./deploy.sh` |
| Solo cambios de Obsidian | `./deploy.sh knowledge` |
| Bajar backups de SQLite a `~/sites/cerebro-os/database/` | `./deploy.sh backup` |
| Subir el último backup al servidor | `./deploy.sh restore` |
| Logs | `./deploy.sh logs` |

Nunca suben: los `.env`, la base de datos, `vendor/`, `.git` ni los archivos internos de `CEREBRO_KNOWLEDGE_EXCLUDE` (ej. `oportunidades.md`).

### Mudarse a otro VPS
1. En el VPS viejo: `./deploy.sh backup`.
2. Preparar el VPS nuevo (pasos 2–3 de arriba) y cambiar `DEPLOY_HOST`.
3. `./deploy.sh` (levanta el proxy de Cerebro si hace falta) → `./deploy.sh restore`.
4. Apuntar el DNS a la IP nueva. 🔒 Rota las keys de Gemini y Telegram si el VPS anterior era compartido.
5. En el VPS viejo: `docker compose -f docker-compose.prod.yml down` en la carpeta de la instancia.

## Nuevo cliente

```bash
cp -r project/chat.anibalcopitan.com project/chat.cliente.com   # sin laravel/ ni .env
git clone <repo-backend> project/chat.cliente.com/laravel
```

En su `.env`: `NAME`/`DOMAIN` = `chat.cliente.com`. En su `laravel/.env`: sus keys. Comparte el proxy del VPS con las demás instancias.
