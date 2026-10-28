#!/bin/sh
# Prepara la app antes de arrancar: dependencias, .env, base SQLite, migraciones y conocimiento.
set -e

[ -d vendor ] || composer install --no-interaction --prefer-dist
[ -f .env ] || cp .env.example .env

if ! grep -q '^APP_KEY=base64' .env; then
    # En producción el .env es de solo lectura: la clave se genera una vez a mano (ver README).
    [ "$APP_ENV" = production ] && { echo "❌ Falta APP_KEY en .env"; exit 1; }
    php artisan key:generate --force
fi

db="${DB_DATABASE:-database/database.sqlite}"
[ -f "$db" ] || touch "$db"
php artisan migrate --force
php artisan knowledge:sync || echo "⚠️  knowledge:sync falló: revisa KNOWLEDGE_PATH"

# Producción: cachea config, rutas y vistas (se rehace en cada arranque, así toma los cambios del .env).
[ "$APP_ENV" = production ] && php artisan optimize

exec "$@"
