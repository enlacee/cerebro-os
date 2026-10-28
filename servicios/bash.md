---
title: Servicio – Bash / Scripting y Automatización en terminal
description: Scripts bash, tareas programadas con cron y automatización de procesos en Linux.
type: servicio
updated: 2026-10-22
---

# Servicio – Bash / Scripting

Automatización real con **bash + cron** en Linux: lo que Aníbal usa a diario y
enseña en sus mentorías 1 a 1 y contenido.

## Qué ofrece

- Creación de **scripts bash** para automatizar tareas repetitivas.
- **Tareas programadas con `cron`/`crontab`**: respaldos nocturnos, limpieza de
  logs, notificaciones, scripts personalizados (ej.: un "bip de reloj" cada hora).
- Comandos y herramientas de terminal para devs y sysadmins.

## Conceptos base que enseña

- **Script**: archivo de texto con una serie de comandos ejecutados en orden.
  ```bash
  #!/bin/bash
  echo "Hola, mundo"
  date
  ```
- **Crontab** (cron table): archivo de tareas programadas.
  ```
  ┌─ minuto (0-59)
  │ ┌─ hora (0-23)
  │ │ ┌─ día del mes (1-31)
  │ │ │ ┌─ mes (1-12)
  │ │ │ │ ┌─ día de semana (0-6, domingo=0/7)
  0 * * * *  → se ejecuta al minuto 0 de cada hora
  ```
- Comandos frecuentes: `ls`, `pwd`, `cat`, `grep`, `awk`, `head`, `tail`,
  `curl`, `ss`, `nmap`, `ping`, `whois`, `ip a`, `nano`/`vim`.

## Cómo se cotiza

Automatizaciones a medida → **acompañamiento tecnológico** o consultoría
(`servicios/asesoria.md`). Aprenderlo → **mentoría Linux 1 a 1** (`servicios/linux.md`).

Ver también: [[linux]] · [[automatizacion-ia]]
