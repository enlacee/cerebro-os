# ── Docker de esta instancia (lo de la app va en laravel/.env) ──
# Nombre de los contenedores: usa el de la carpeta (ej. chat.rapitaller.com).
NAME=chat.rapitaller.com

# ── Solo en el VPS ──
# Dominio público (registro A → IP del VPS) y email para el certificado HTTPS.
DOMAIN=chat.rapitaller.com
EMAIL=chat.rapitaller.com@anibalcopitan.com
# En el servidor, para usar "docker compose" sin -f.
COMPOSE_FILE=docker-compose.prod.yml
# Dueño de los archivos en el servidor (id -u / id -g).
UID=1000
GID=1000

# ── Solo en tu PC ──
APP_PORT=81
