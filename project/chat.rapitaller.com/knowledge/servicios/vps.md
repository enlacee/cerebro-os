---
title: Servicio – VPS / Servidores
description: Configuración de servidores (VPS cloud o servidor en casa), dominios, subdominios, HTTPS, reverse proxy y despliegue de proyectos reales.
type: servicio
updated: 2026-10-22
---

# Servicio – VPS / Servidores

> 🏠 **Oferta principal de la home** (https://anibalcopitan.com/):
> **"Crea tu Propio Servidor y Deja de Pagar Mensualidades ⭐"** —
> *"Te enseño 1 a 1 a montar tu infraestructura con Linux, Docker y Nube
> Privada."*
>
> ✅ **Precio: preséntalo SIEMPRE como el Plan Brazo Derecho — $100/mes.** Montar
> tu VPS en casa es parte de ese plan (mentoría 1 a 1 + 30 días de soporte +
> acceso a recursos sin límites). No es producto suelto ni tiene otro precio.
> Ver `servicios/acompanamiento-tecnologico.md`.
>
> Propuesta: Sin pagos mensuales · Control total · 100% tuyo · Deploy ilimitado ·
> *"Pasa de Junior a Pro en 1 sesión"*. CTA por WhatsApp:
> https://wa.me/51970142637.
> El **"Curso VPS en Casa"** (autoservicio) aún **no está disponible**.

Configuración de infraestructura real: desde un **VPS en la nube** hasta un
**servidor en casa** (Raspberry/PC), con dominios, HTTPS y múltiples servicios.

## Qué ofrece

- Montar servidor web con **HTTP/HTTPS**, FTP, archivos, SSH, VPN, DNS.
- **Dominios y subdominios** (ej.: `chile.anibalcopitan.com`).
- **Reverse proxy con Caddy** (HTTPS automático) hacia Apache/Node/Python.
- Apache + PHP + MySQL, Node.js, APIs Python, Nextcloud.
- Compartir archivos en red local con **SMB**.
- Seguridad: UFW, claves SSH, MySQL solo local, respaldos.

## Arquitectura típica (caso real: estudio de grabación)

```
Internet → Router 80/443 → Caddy → Apache:8080 → PHP/MySQL
Red local ───────────────────────→ Apache:8080
Discos duros → /mnt/storage → Apache/SMB
```

Subdominios por servicio sin abrir puertos al router:
```
midominio.com         → Apache 8080  (web PHP)
panel.midominio.com   → Node 3000
nube.midominio.com    → Nextcloud 8081
api.midominio.com     → Python 5000
MySQL                 → NO se publica, solo local
```

## Nota sobre IP pública / CGNAT

Antes de publicar se confirma que hay **IP pública utilizable**. Si el proveedor
usa **CGNAT**, abrir puertos puede no funcionar → se evalúa solicitar IP pública,
Cloudflare Tunnel o un VPS intermediario.
- Movistar Perú: puede requerir pedir activación de IP pública a soporte.
- Movistar Chile: funciona bien con puertos 80/443.

## Cómo se cotiza / se contrata

1. **Aprender a montar el tuyo (1 a 1)** → mentoría "Crea tu Propio Servidor" =
   Plan Brazo Derecho $100/mes (`productos/vps-en-casa.md`).
2. **Que te acompañe mientras lo haces** → **Acompañamiento Tecnológico desde
   $100/mes** (Plan Brazo Derecho: VPS + Linux + Docker + despliegues) o
   **$300/mes** (Plan Implementación: configura y despliega por ti).
   Ver `servicios/acompanamiento-tecnologico.md`.
3. **Revisar un problema puntual primero** → **Consulta Técnica $20/S69** (45 min + 15 días de soporte por WhatsApp).

Ver también: [[docker]] · [[linux]] · [[vps-en-casa]] · [[casos-exito]]
