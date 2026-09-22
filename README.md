# Barber Kong — Backend

API del Sistema de Gestión para Barbería, proyecto de Seminario de Sistemas 1 (CUNOC,
segundo semestre 2026). Stack: Node.js (ESM) + Express, PostgreSQL con **SQL plano
parametrizado (sin ORM)**. El frontend vive en
[Barber-Kong-Frontend](https://github.com/brandonsk8/Barber-Kong-Frontend).

Ver [CLAUDE.md](./CLAUDE.md) para las reglas de arquitectura del proyecto.

## Requisitos

- Node.js 20+
- PostgreSQL 16 instalado y corriendo **localmente** (sin Docker). El usuario configurado
  en tu `.env.dev` debe tener permiso de `CREATEDB`.

## Levantar el entorno local

```bash
cp .env.example .env.dev
npm install
npm run db:setup     # crea la base si no existe, aplica resources/db/schema.sql y seed.sql
npm run dev
```

Verificar en `http://localhost:3000/api/health`. Credenciales sembradas: ver
[resources/db/seed.sql](./resources/db/seed.sql) — `admin@barberkong.com` y los 4
barberos demo, todos con la contraseña `BarberKong2026!`.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga automática, contra `.env.dev` |
| `npm start` | Servidor en modo producción, contra `.env.prod` |
| `npm run db:setup` | Crea la BD de desarrollo si no existe y aplica schema + seed |
| `npm run db:reset` | `DROP SCHEMA public CASCADE` + recrea todo desde cero (desarrollo) |

## Base de datos: sin ORM

El esquema completo vive en [resources/db/schema.sql](./resources/db/schema.sql) (DDL
plano, idempotente) y los datos de ejemplo en
[resources/db/seed.sql](./resources/db/seed.sql). `scripts/db/setup.mjs` los aplica
contra tu Postgres local usando el driver `pg` directo — no hay migraciones ni modelos
generados; si cambias el esquema, edita `schema.sql` directamente y documenta el cambio.

Los ids son UUID generados en la aplicación (`node:crypto` `randomUUID()`), no en la
base de datos, para no depender de extensiones de Postgres.

## Estructura

```
index.js                    Punto de entrada: conecta la BD, arma la app, escucha el puerto
src/
  server/app.js              Configuración de Express (middlewares, health check, 404, errores)
  modules/                   Un módulo por dominio del sistema — TODO desarrollo nuevo va aquí
    index.js                 Escanea *.routes.js recursivamente y los monta solo
    servicios/                Módulo de referencia — mismo patrón en todos los demás
    auth/                     EP-01 — login, registro, 2FA, recuperar/restablecer contraseña, /me
    barberos/                 Alta/edición/baja de barberos (UC-22/23/24) + disponibilidad por fecha
    citas/                    EP-02 — agendar/reprogramar/cancelar, agenda del barbero, walk-in,
                               marcar atendida (dispara el descuento de inventario en transacción)
    clientes/                 EP-03 — CRUD de clientes (admin)
    inventario/                EP-05 — catálogo de insumos, reabastecimiento, descuento automático
      inventario.instance.js    Instancia compartida del service, reusada por citas/ sin duplicar lógica
    reportes/ notificaciones/  Todavía en stub — fuera de alcance de Fase 2
  middlewares/auth.middleware.js   requireAuth/requireRole (JWT) — implementado (EP-01)
  services/                  Infraestructura compartida entre módulos: correo, notificaciones
  helpers/                   ApiError, errorHandler, validate (Ajv)
  config/                    db.js (pool de pg), logger.js (winston)
resources/db/               schema.sql y seed.sql — única fuente de verdad del esquema
scripts/db/setup.mjs        Crea la BD local y aplica schema + seed
```

### Estado de los módulos (Fase 2)

| Módulo | Estado | Notas |
|---|---|---|
| `servicios` | ✅ Completo | Ya venía del scaffold inicial. |
| `auth` | ✅ Completo | JWT, bcrypt, 2FA por código de 6 dígitos (10 min), recuperación de contraseña (1 hora). |
| `barberos` | ✅ Completo | Alta crea también el `users` con role='barbero'; disponibilidad calculada a partir de `citas`. |
| `citas` | ✅ Completo | Incluye el "proceso complejo" de la rúbrica: atender -> descuento de insumos -> alerta de stock bajo, en una sola transacción. |
| `clientes` | ✅ Completo | CRUD básico bajo administración. |
| `inventario` | ✅ Completo | Catálogo + reabastecimiento + función de descuento reutilizada por `citas`. |
| `reportes`, `notificaciones` (centro in-app) | ⏳ Pendiente | Planeado para Sprint 3 / Fase 3. El envío de correos ya funciona (`notification.service.js`); falta el endpoint para listar/marcar leídas. |

**Nota sobre correo en desarrollo:** si no configurás `SMTP_USER`/`SMTP_PASSWORD` en tu
`.env.dev`, el envío de correo falla silenciosamente (con timeout de 5s) y queda
registrado como advertencia en el log — el flujo principal (login, agendar cita, etc.)
no se bloquea. Para ver el contenido real de un código 2FA o un enlace de recuperación
en desarrollo sin SMTP configurado, consultá la tabla `notificaciones` directamente:
`SELECT mensaje FROM notificaciones ORDER BY created_at DESC LIMIT 1;`

### Cómo agregar un módulo nuevo

1. Copia la carpeta `src/modules/servicios/` como plantilla.
2. Cambia el nombre de los 5 archivos y su contenido a tu dominio.
3. No hace falta registrar nada: `src/modules/index.js` lo monta solo bajo
   `/api/<nombre-de-la-carpeta>` en cuanto detecta el `*.routes.js`.
