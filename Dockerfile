FROM dunglas/frankenphp:1-php8.4

ARG UID=1000
ARG GID=1000

RUN install-php-extensions pdo_sqlite intl zip opcache pcntl \
    && groupadd -g ${GID} app && useradd -u ${UID} -g ${GID} -m app \
    && setcap CAP_NET_BIND_SERVICE=+eip /usr/local/bin/frankenphp \
    && chown -R app:app /config/caddy /data/caddy

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY docker/entrypoint.sh /usr/local/bin/cerebro-entrypoint

WORKDIR /app
USER app

ENTRYPOINT ["cerebro-entrypoint"]
CMD ["frankenphp", "run", "--config", "/etc/frankenphp/Caddyfile"]
