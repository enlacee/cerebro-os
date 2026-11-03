# Nueva instancia (cliente nuevo)

Guía paso a paso para levantar el chat de un negocio nuevo. Ejemplo: **Taller Juan** en `chat.tallerjuan.com`.

Una instancia = una carpeta en `project/`. La carpeta `laravel/` es **igual en todas y no se edita**: lo propio del negocio va en 3 lugares.

| Archivo | Qué lleva |
|---|---|
| `.env` | Docker: `NAME`, `DOMAIN`, `EMAIL`, `APP_PORT` |
| `laravel/.env` | La app: sección **Chat** (nombre, WhatsApp, saludo, horarios, chips), keys, dominios permitidos |
| `knowledge/` | Notas de Obsidian del negocio (**solo lo público**) |

## 1. Pedir los datos al cliente

- [ ] Nombre del negocio y de quien atiende (ej. "Taller Juan" y "Juan")
- [ ] WhatsApp con código de país (ej. `51987654321`)
- [ ] Días y horas en que acepta llamadas, y su zona horaria
- [ ] Su web (dominios donde irá el chat) y el subdominio del chat (ej. `chat.tallerjuan.com`)
- [ ] Servicios, precios, preguntas frecuentes, links oficiales → para `knowledge/`
- [ ] 3 a 6 temas para los chips (ej. "🔧 Precios")
- [ ] Color de su marca (opcional)
- [ ] API key de Gemini **de pago, a su nombre** (el plan gratis puede usar los datos para entrenar)

## 2. Crear la carpeta

Desde la raíz del repo (`~/sites/cerebro-os/app`). Copia solo lo versionado: sin `.env`, base de datos, `vendor/` ni tu conocimiento.

```bash
N=chat.tallerjuan.com
mkdir project/$N
git archive HEAD:project/chat.anibalcopitan.com | tar -x -C project/$N --exclude=knowledge
mkdir -p project/$N/knowledge/recursos
```

## 3. `.env` (Docker)

```bash
cd project/$N
cp .env.example .env
```

```env
NAME=chat.tallerjuan.com      # nombre de los contenedores (= carpeta)
DOMAIN=chat.tallerjuan.com
EMAIL=tu@correo.com           # para el certificado HTTPS
APP_PORT=8082                 # solo local: un puerto libre por instancia (80, 8081, 8082…)
```

## 4. `laravel/.env` (la app)

```bash
cp laravel/.env.example laravel/.env
```

Edita la sección **Chat** (viene con los valores de Aníbal como ejemplo):

```env
CEREBRO_BUSINESS_NAME="Taller Juan"
CEREBRO_OWNER_NAME="Juan"                 # "Hablar con Juan", "Que Juan me llame"
CEREBRO_WHATSAPP=51987654321              # solo dígitos
CEREBRO_GREETING="¡Hola! 👋 Soy el asistente de Taller Juan. ¿Qué necesitas?"
CEREBRO_COLOR_ACCENT="#1a73e8"
CEREBRO_TIMEZONE=America/Lima

CEREBRO_CALL_DAYS=1-6                     # 1 = lunes … 7 = domingo · o "1,3,5"
CEREBRO_CALL_HOURS="09:00-10:00,17:00-18:00"
CEREBRO_CALL_TIMEZONE_LABEL="hora Perú"
CEREBRO_CALL_COUNTRY_CODE="+51"
CEREBRO_CALL_INTRO='Llamada rápida por WhatsApp (3 min) para conocerte y saber qué necesitas.'

# Chips (máx. 8): "texto del botón | mensaje que se envía". Borra los que sobren.
CEREBRO_TOPIC_1="🔧 Precios | ¿Cuánto cuesta un mantenimiento?"
CEREBRO_TOPIC_2="📍 Ubicación | ¿Dónde están?"
```

Y además:

```env
GEMINI_API_KEY=...                        # la del cliente
CEREBRO_ALLOWED_ORIGINS=*                 # local; en producción, su web (paso 8)
```

`APP_KEY` se genera solo al arrancar en local. Textos con `$` (ej. `$20`): usa comillas simples.

## 5. `knowledge/` (vault de Obsidian)

Ábrelo en Obsidian con "Open folder as vault". Todo lo que esté aquí lo puede repetir el bot: **nada interno** (costos, clientes, notas privadas).

| Archivo | Para qué |
|---|---|
| `README.md` | **Obligatorio.** Quién es el negocio, qué vende, contacto. Va primero en el prompt |
| `recursos/asistente-guia.md` | **Obligatorio.** Tono, cómo vender, qué no decir. Va segundo |
| `servicios/`, `productos/`, `preguntas/`, `politicas/`… | Una nota por tema, con precios y links oficiales |

Usa las de `chat.anibalcopitan.com/knowledge/` como modelo de estructura, pero **reescríbelas**: no copies contenido de Aníbal.

## 6. Probar en local

```bash
docker compose up -d
```

- Abre `http://localhost:8082/` (el puerto de `APP_PORT`).
- La primera vez instala `vendor/` (1–2 min): el scheduler se reinicia solo hasta que termina.
- Revisa: nombre, saludo, chips, botón de WhatsApp (abre el número del cliente) y "Que … me llame".
- Pregunta cosas reales y algo fuera de tema (debe negarse).
- ¿Cambiaste el `.env` de Docker? → `docker compose up -d --force-recreate`
- ¿Cambiaste `laravel/.env`? → en local se aplica solo; en el VPS, `docker compose restart`
- ¿Cambiaste `knowledge/`? → `docker compose exec app php artisan knowledge:sync`

## 7. Avisos por Telegram (opcional)

1. Crea un bot con @BotFather y pon el token en `TELEGRAM_BOT_TOKEN`.
2. Escríbele cualquier cosa al bot desde el Telegram de quien recibe los avisos.
3. `docker compose exec app php artisan telegram:setup` → te da el `TELEGRAM_CHAT_ID`; ponlo en `laravel/.env`.
4. Corre `telegram:setup` otra vez: envía un mensaje de prueba.

## 8. Producción

1. **Git** (en tu PC): `git add project/$N && git commit -m "add: instancia $N" && git push`. Revisa que no entre ningún `.env` (`git status`).
2. **DNS**: registro `A` de `chat.tallerjuan.com` → IP del VPS.
3. **VPS**, en `~/cerebro-os`: `git pull` y luego, en `project/chat.tallerjuan.com/`, crea los dos `.env` (`chmod 600`):
   - `.env`: como el del paso 3, más `COMPOSE_FILE=docker-compose.prod.yml` (sin `APP_PORT`).
   - `laravel/.env`: desde `laravel/.env.production.example` + la sección Chat del paso 4, y:
     ```env
     APP_URL=https://chat.tallerjuan.com
     APP_KEY=                                  # echo "base64:$(openssl rand -base64 32)"
     CEREBRO_ALLOWED_ORIGINS=https://tallerjuan.com,https://www.tallerjuan.com
     CEREBRO_TRUSTED_PROXIES=docker            # "docker,cloudflare" si el dominio pasa por Cloudflare
     ```
4. Levanta y comprueba:
   ```bash
   docker compose up -d && docker compose logs -f app
   curl -I https://chat.tallerjuan.com/up
   ```

El resto (proxy, backups, actualizar, mudarse): `README.md` → Producción.

## 9. Entregar al cliente

Que pegue esto en su web, antes de `</body>`:

```html
<script src="https://chat.tallerjuan.com/widget.js" defer></script>
```

Y que configure un tope de gasto en su API key de Gemini.

## Actualizar el código de todas las instancias

Los arreglos se hacen en `chat.anibalcopitan.com/laravel/`. Para pasarlos a otra instancia (desde la raíz, después del commit):

```bash
git archive HEAD:project/chat.anibalcopitan.com/laravel | tar -x -C project/chat.tallerjuan.com/laravel
```

Sobrescribe el código y no toca `.env`, base de datos ni `vendor/`. Si se **borró** algún archivo en el original, bórralo a mano en la copia. Luego `git commit`, `git push` y en el VPS `git pull && docker compose restart`.

## Checklist final

- [ ] `.env` y `laravel/.env` creados y **fuera de git**
- [ ] `knowledge/` solo con contenido público y sin datos de otro negocio
- [ ] `CEREBRO_ALLOWED_ORIGINS` = solo la web del cliente
- [ ] API key de Gemini del cliente, con tope de gasto
- [ ] Probado: chips, WhatsApp, "que me llame", aviso en Telegram
- [ ] `https://chat.cliente.com/up` responde 200
