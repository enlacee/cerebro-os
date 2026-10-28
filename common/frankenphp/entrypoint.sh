#!/bin/sh
# Prepara la app antes de arrancar: dependencias, .env, base SQLite, migraciones y conocimiento.
set -e

if [ "$APP_ENV" = production ]; then
    # Siempre: rápido si no cambió nada, y deja fuera las dependencias de desarrollo.
    composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist
else
    [ -d vendor ] || composer install --no-interaction --prefer-dist
fi

[ -f .env ] || cp .env.example .env

if ! grep -q '^APP_KEY=base64' .env; then
    # En producción la clave se genera una vez a mano (ver README de infraestructura).
    [ "$APP_ENV" = production ] && { echo "❌ Falta APP_KEY en laravel/.env"; exit 1; }
    php artisan key:generate --force
fi

db="${DB_DATABASE:-database/database.sqlite}"
[ -f "$db" ] || touch "$db"
php artisan migrate --force
php artisan knowledge:sync || echo "⚠️  knowledge:sync falló: revisa KNOWLEDGE_PATH"

# Producción: cachea config, rutas y vistas (se rehace en cada arranque, así toma los cambios del .env).
if [ "$APP_ENV" = production ]; then php artisan optimize; fi

exec "$@"
