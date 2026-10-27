#!/bin/sh
# Prepara la app antes de arrancar: dependencias, .env, base SQLite, migraciones y conocimiento.
set -e

[ -d vendor ] || composer install --no-interaction --prefer-dist
[ -f .env ] || cp .env.example .env
grep -q '^APP_KEY=base64' .env || php artisan key:generate --force

[ -f database/database.sqlite ] || touch database/database.sqlite
php artisan migrate --force
php artisan knowledge:sync || echo "⚠️  knowledge:sync falló: revisa KNOWLEDGE_PATH"

exec "$@"
