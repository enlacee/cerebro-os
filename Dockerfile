FROM dunglas/frankenphp:1-php8.4 AS base

ARG UID=1000
ARG GID=1000

RUN install-php-extensions pdo_sqlite intl zip opcache pcntl \
    && groupadd -g ${GID} app && useradd -u ${UID} -g ${GID} -m app \
    && setcap CAP_NET_BIND_SERVICE=+eip /usr/local/bin/frankenphp \
    && chown -R app:app /config/caddy /data/caddy

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY docker/entrypoint.sh /usr/local/bin/cerebro-entrypoint

WORKDIR /app
ENTRYPOINT ["cerebro-entrypoint"]
CMD ["frankenphp", "run", "--config", "/etc/frankenphp/Caddyfile"]

# Desarrollo: el código se monta desde el host (docker-compose.yml).
FROM base AS dev
USER app

# Producción: el código va dentro de la imagen, sin dependencias de desarrollo (docker-compose.prod.yml).
FROM base AS prod
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && mkdir -p /app/data && chown app:app /app /app/data
USER app
COPY --chown=app:app composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --prefer-dist
COPY --chown=app:app . .
RUN composer dump-autoload --optimize --no-dev && php artisan package:discover
