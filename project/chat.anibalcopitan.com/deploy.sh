#!/usr/bin/env bash
# Despliegue desde tu PC al VPS (por SSH, sin GitHub). En el servidor queda la misma estructura:
#   ~/cerebro-os/common/…  +  ~/cerebro-os/project/<esta carpeta>/
#
#   ./deploy.sh            sube todo y levanta (y el proxy de Cerebro si el VPS no tiene uno)
#   ./deploy.sh knowledge  solo el conocimiento (tras editar Obsidian)
#   ./deploy.sh backup     baja los backups de SQLite a ~/sites/cerebro-os/database/
#   ./deploy.sh restore    sube el último backup local al servidor (para mudarte de VPS)
#   ./deploy.sh logs       ver logs en vivo
set -euo pipefail
cd "$(dirname "$0")"

env_get() { grep -E "^$2=" "$1" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'; }
HOST=$(env_get .env DEPLOY_HOST); ROOT=$(env_get .env DEPLOY_DIR); ROOT=${ROOT:-cerebro-os}
KNOWLEDGE=$(env_get .env KNOWLEDGE_PATH); EXCLUDE=$(env_get laravel/.env CEREBRO_KNOWLEDGE_EXCLUDE)
[ -n "$HOST" ] || { echo "❌ Falta DEPLOY_HOST en .env"; exit 1; }
DIR="$ROOT/project/$(basename "$PWD")"
BACKUPS=../../../database
compose="cd $DIR && docker compose -f docker-compose.prod.yml"

knowledge() {
    # Los archivos internos (ej. oportunidades.md) no salen de tu PC.
    local args=(--exclude .obsidian --exclude .git)
    IFS=, read -ra files <<< "$EXCLUDE"
    for f in "${files[@]}"; do [ -n "$f" ] && args+=(--exclude "$f"); done
    rsync -az --delete "${args[@]}" "$KNOWLEDGE/" "$HOST:$DIR/knowledge/"
}

# Si nadie usa el puerto 80 en el VPS, levanta el proxy de Cerebro; si ya hay uno (ej. el de rapitaller), lo usa.
proxy() {
    if [ -z "$(ssh "$HOST" "docker ps -q --filter publish=80")" ]; then
        echo "▶ VPS sin proxy: levantando common/proxy de Cerebro"
        ssh "$HOST" "cd $ROOT/common/proxy && docker compose up -d"
    else
        echo "▶ Proxy existente en el VPS: $(ssh "$HOST" "docker ps --filter publish=80 --format '{{.Names}}'")"
    fi
    ssh "$HOST" "docker network inspect red >/dev/null 2>&1" \
        || { echo "❌ El proxy del VPS no usa la red \"red\": conecta Cerebro a la red de ese proxy"; exit 1; }
}

case "${1:-all}" in
    all)
        ssh "$HOST" "test -f $DIR/.env && test -f $DIR/laravel/.env" \
            || { echo "❌ Crea en el servidor $DIR/.env y $DIR/laravel/.env (ver README)"; exit 1; }
        [ "$(env_get .env NAME)" = "$(basename "$PWD")" ] || echo "⚠️  NAME en .env no coincide con la carpeta $(basename "$PWD")"
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
        proxy
        ssh "$HOST" "$compose up -d --build && docker image prune -f >/dev/null && $compose ps"
        ;;
    knowledge)
        knowledge
        ssh "$HOST" "$compose exec -T app php artisan knowledge:sync"
        ;;
    backup)
        ssh "$HOST" "$compose exec -T app php artisan db:backup"
        mkdir -p "$BACKUPS"
        rsync -az "$HOST:$DIR/laravel/storage/app/backups/" "$BACKUPS/"
        ls -lh "$BACKUPS" | tail -5
        ;;
    restore)
        latest=$(ls -1 "$BACKUPS"/database-*.sqlite 2>/dev/null | sort | tail -1)
        [ -n "$latest" ] || { echo "❌ No hay backups en $BACKUPS (corre ./deploy.sh backup en el VPS viejo)"; exit 1; }
        read -rp "Reemplazar la base de $HOST con $(basename "$latest")? (la actual se respalda antes) [s/N] " ok
        [ "$ok" = s ] || exit 1
        ssh "$HOST" "$compose exec -T app php artisan db:backup 2>/dev/null || true; $compose stop app scheduler"
        rsync -az "$latest" "$HOST:$DIR/laravel/database/database.sqlite"
        ssh "$HOST" "$compose up -d && $compose ps"
        ;;
    logs) ssh -t "$HOST" "$compose logs -f --tail 100" ;;
    *) sed -n 2,10p "$0"; exit 1 ;;
esac
