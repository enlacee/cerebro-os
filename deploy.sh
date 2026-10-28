#!/usr/bin/env bash
# Despliegue desde tu PC al VPS (por SSH, sin GitHub).
#   ./deploy.sh            sube código + conocimiento y reconstruye
#   ./deploy.sh knowledge  solo el conocimiento (tras editar Obsidian)
#   ./deploy.sh backup     baja los backups de SQLite a ~/sites/cerebro-os/database/
#   ./deploy.sh logs       ver logs en vivo
# Necesita en tu .env local: DEPLOY_HOST=deploy@IP_DEL_VPS (y opcional DEPLOY_DIR).
set -euo pipefail
cd "$(dirname "$0")"

env_get() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- | tr -d '"'; }
HOST=$(env_get DEPLOY_HOST); DIR=$(env_get DEPLOY_DIR); DIR=${DIR:-cerebro-os}
KNOWLEDGE=$(env_get KNOWLEDGE_PATH); EXCLUDE=$(env_get CEREBRO_KNOWLEDGE_EXCLUDE)
[ -n "$HOST" ] || { echo "❌ Falta DEPLOY_HOST en .env"; exit 1; }
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
        ssh "$HOST" "test -f $DIR/.env" || { echo "❌ Crea $DIR/.env en el servidor (ver .env.production.example)"; exit 1; }
        # --delete no toca lo excluido: el .env del servidor queda intacto.
        rsync -az --delete \
            --exclude .git --exclude .env --exclude knowledge --exclude vendor --exclude node_modules \
            --exclude 'database/*.sqlite' --exclude 'storage/logs/*.log' --exclude storage/app/backups \
            --exclude storage/app/knowledge.md --exclude '.phpunit*' \
            ./ "$HOST:$DIR/"
        knowledge
        ssh "$HOST" "$compose up -d --build && docker image prune -f >/dev/null"
        ssh "$HOST" "$compose ps"
        ;;
    knowledge)
        knowledge
        ssh "$HOST" "$compose exec -T app php artisan knowledge:sync"
        ;;
    backup)
        mkdir -p ../../../database
        ssh "$HOST" "$compose exec -T app php artisan db:backup"
        ssh "$HOST" "rm -rf /tmp/cerebro-backups && $compose cp app:/app/data/backups /tmp/cerebro-backups"
        rsync -az "$HOST:/tmp/cerebro-backups/" ../../../database/
        ssh "$HOST" "rm -rf /tmp/cerebro-backups"
        ls -lh ../../../database | tail -5
        ;;
    logs) ssh -t "$HOST" "$compose logs -f --tail 100" ;;
    *) sed -n 2,7p "$0"; exit 1 ;;
esac
