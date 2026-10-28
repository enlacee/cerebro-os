# Imagen de Cerebro OS: solo PHP + Caddy (FrankenPHP). El código Laravel se monta desde ./laravel de cada instancia.
FROM dunglas/frankenphp:1-php8.4 AS base

ARG UID=1000
ARG GID=1000

RUN install-php-extensions pdo_sqlite intl zip opcache pcntl \
    && groupadd -g ${GID} app && useradd -u ${UID} -g ${GID} -m app \
    && setcap CAP_NET_BIND_SERVICE=+eip /usr/local/bin/frankenphp \
    && chown -R app:app /config/caddy /data/caddy

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY entrypoint.sh /usr/local/bin/cerebro-entrypoint

WORKDIR /app
ENTRYPOINT ["cerebro-entrypoint"]
CMD ["frankenphp", "run", "--config", "/etc/frankenphp/Caddyfile"]

# Desarrollo (docker-compose.yml)
FROM base AS dev
USER app

# Producción (docker-compose.prod.yml): php.ini de producción
FROM base AS prod
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
USER app
