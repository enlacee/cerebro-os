# 🧠 Cerebro OS · Infraestructura

Cómo se **levanta** Cerebro OS (Docker + despliegue). El backend vive aparte, en `project/<instancia>/laravel/` (su propio repo git).

```
app/                                   ← este repo
├── common/frankenphp/                 ← la imagen: PHP 8.4 + Caddy (HTTPS automático)
│   ├── Dockerfile                     (targets: dev / prod)
│   └── entrypoint.sh                  (composer, .env, SQLite, migraciones, conocimiento)
└── project/
    └── chat.anibalcopitan.com/        ← una carpeta por instancia (cliente)
        ├── docker-compose.yml         ← local
        ├── docker-compose.prod.yml    ← VPS
        ├── .env                       ← Docker: nombre, puerto, dominio, KNOWLEDGE_PATH, DEPLOY_HOST (no se versiona)
        ├── deploy.sh                  ← sube al VPS por SSH
        └── laravel/                   ← repo del backend (no se versiona aquí)
            └── .env                   ← la app: keys de Gemini y Telegram, CORS…
```

Dos `.env` distintos: **`.env` de la instancia = Docker**, **`laravel/.env` = la app**.

## Local

```bash
cd project/chat.anibalcopitan.com
cp .env.example .env           # KNOWLEDGE_PATH = tu vault de Obsidian
docker compose up -d --build   # http://localhost:8000/demo.html
docker compose exec app php artisan test
```

Dos contenedores con la misma imagen y el mismo código: `app` (web) y `scheduler` (recordatorios, backup diario 3 am y borrado de datos vencidos).

## Producción (VPS DigitalOcean)

FrankenPHP (Caddy) saca el HTTPS solo: sin nginx ni certbot.

**Una sola vez:**
1. Droplet Ubuntu 24.04 (1 GB) con tu **llave SSH**.
2. DNS: registro `A` `chat` → IP del droplet. En Cloudflare, **nube gris** ("DNS only"): Caddy saca el certificado y el límite por IP ve la IP real.
3. En el servidor, como root:
   ```bash
   apt update && apt -y upgrade && apt -y install docker.io docker-compose-v2 unattended-upgrades rsync
   adduser --disabled-password --gecos "" deploy && usermod -aG docker deploy
   mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy: /home/deploy/.ssh
   sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/; s/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config && systemctl restart ssh
   ufw allow OpenSSH && ufw allow 80,443/tcp && ufw allow 443/udp && ufw --force enable
   ```
4. Como `deploy`, crea los dos `.env` (`chmod 600`):
   - `~/cerebro-os/project/chat.anibalcopitan.com/.env` → `SERVER_NAME=chat.anibalcopitan.com`, `COMPOSE_PROJECT_NAME=cerebro-anibalcopitan` (y `UID`/`GID` = `id -u`/`id -g`)
   - `~/cerebro-os/project/chat.anibalcopitan.com/laravel/.env` → desde `laravel/.env.production.example` (keys reales, `APP_KEY`)
5. En tu PC, en el `.env` de la instancia: `DEPLOY_HOST=deploy@IP`.

**Cada vez (desde la carpeta de la instancia en tu PC):**

| Qué | Comando |
|---|---|
| Subir cambios (imagen, compose, código, conocimiento) | `./deploy.sh` |
| Solo cambios de Obsidian | `./deploy.sh knowledge` |
| Bajar backups de SQLite a `~/sites/cerebro-os/database/` | `./deploy.sh backup` |
| Logs | `./deploy.sh logs` |

- Nunca suben: los `.env`, la base de datos, `vendor/`, `.git` ni los archivos internos de `CEREBRO_KNOWLEDGE_EXCLUDE` (ej. `oportunidades.md`).
- En el servidor queda la misma estructura: `~/cerebro-os/common/…` + `~/cerebro-os/project/<instancia>/…`.

## Nuevo cliente

```bash
cp -r project/chat.anibalcopitan.com project/chat.cliente.com   # sin laravel/ ni .env
git clone <repo-backend> project/chat.cliente.com/laravel
```

Cambia `COMPOSE_PROJECT_NAME`, `SERVER_NAME` y su `laravel/.env`. Si comparte VPS con otra instancia, hace falta un proxy en `common/` (solo uno puede usar los puertos 80/443).
