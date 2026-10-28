#!/usr/bin/env bash
# Despliegue desde tu PC al VPS (por SSH, sin GitHub). En el servidor queda la misma estructura:
#   ~/cerebro-os/common/frankenphp  +  ~/cerebro-os/project/<esta carpeta>/
#
#   ./deploy.sh            sube imagen, compose, código y conocimiento, y reconstruye
#   ./deploy.sh knowledge  solo el conocimiento (tras editar Obsidian)
#   ./deploy.sh backup     baja los backups de SQLite a ~/sites/cerebro-os/database/
#   ./deploy.sh logs       ver logs en vivo
set -euo pipefail
cd "$(dirname "$0")"

env_get() { grep -E "^$2=" "$1" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'; }
HOST=$(env_get .env DEPLOY_HOST); ROOT=$(env_get .env DEPLOY_DIR); ROOT=${ROOT:-cerebro-os}
KNOWLEDGE=$(env_get .env KNOWLEDGE_PATH); EXCLUDE=$(env_get laravel/.env CEREBRO_KNOWLEDGE_EXCLUDE)
[ -n "$HOST" ] || { echo "❌ Falta DEPLOY_HOST en .env"; exit 1; }
DIR="$ROOT/project/$(basename "$PWD")"
compose="cd $DIR && docker compose -f docker-compose.prod.yml"

knowledge() {
    # Los archivos internos (ej. oportunidades.md) no salen de tu PC.
    local args=(--exclude .obsidian --exclude .git)
    IFS=, read -ra files <<< "$EXCLUDE"
    for f in "${files[@]}"; do [ -n "$f" ] && args+=(--exclude "$f"); done
    rsync -az --delete "${args[@]}" "$KNOWLEDGE/" "$HOST:$DIR/knowledge/"
}

case "${1:-all}" in
    all)
        ssh "$HOST" "test -f $DIR/.env && test -f $DIR/laravel/.env" \
            || { echo "❌ Crea en el servidor $DIR/.env y $DIR/laravel/.env (ver README)"; exit 1; }
        rsync -az --delete ../../common/ "$HOST:$ROOT/common/"
        # --delete no toca lo excluido: los .env, la base de datos y los backups del servidor quedan intactos.
        rsync -az --delete \
            --exclude .env --exclude /knowledge --exclude laravel/.env --exclude laravel/.git \
            --exclude laravel/vendor --exclude laravel/node_modules --exclude laravel/knowledge \
            --exclude 'laravel/database/*.sqlite' --exclude 'laravel/bootstrap/cache/*.php' \
            --exclude 'laravel/storage/logs/*' --exclude 'laravel/storage/app/*' --exclude 'laravel/storage/framework/*/*' \
            --exclude 'laravel/.phpunit*' --exclude laravel/public/hot \
            ./ "$HOST:$DIR/"
        knowledge
        ssh "$HOST" "$compose up -d --build && docker image prune -f >/dev/null && $compose ps"
        ;;
    knowledge)
        knowledge
        ssh "$HOST" "$compose exec -T app php artisan knowledge:sync"
        ;;
    backup)
        ssh "$HOST" "$compose exec -T app php artisan db:backup"
        mkdir -p ../../../database
        rsync -az "$HOST:$DIR/laravel/storage/app/backups/" ../../../database/
        ls -lh ../../../database | tail -5
        ;;
    logs) ssh -t "$HOST" "$compose logs -f --tail 100" ;;
    *) sed -n 2,9p "$0"; exit 1 ;;
esac
