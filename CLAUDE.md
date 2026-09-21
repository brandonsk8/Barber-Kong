# CLAUDE.md — barber-kong (backend)

Contexto y reglas de trabajo para asistentes de IA en este repositorio.

## Qué es este proyecto

API Node.js (ESM, `"type": "module"`) del Sistema de Gestión para Barber Kong, una
barbería en Xela (Quetzaltenango, Guatemala). Proyecto de Seminario de Sistemas 1
(CUNOC). PostgreSQL es la única base de datos, **sin ORM**: el acceso a datos es SQL
parametrizado a mano.

Boot: `index.js` → conecta la BD → `src/server/app.js` (`createApp()`) → monta todos los
módulos vía `mountModules()`.

## Comandos

- `npm run dev` — desarrollo con recarga automática, contra `.env.dev`
- `npm run db:setup` — crea la BD local si no existe, aplica migraciones pendientes de `resources/db/migrations/` y siembra `seed.sql`
- `npm run db:migrate` — solo aplica migraciones pendientes (sin seed, sin crear la BD)
- `npm run db:reset` — `DROP SCHEMA public CASCADE` y recrea todo desde cero
- `node --check <archivo>` — validación de sintaxis (ESM, funciona directo)

No hay una suite de pruebas automatizada en este repo. Verificar los cambios arrancando
el servidor (`npm run dev`) y probando los endpoints afectados a mano antes de dar por
terminado un fix o una funcionalidad.

## REGLAS DURAS (no negociables)

1. **Nunca interpolar valores en SQL con template strings** (`` `WHERE id = '${id}'` ``).
   Todo query usa parámetros posicionales de `pg`: `query('... WHERE id = $1', [id])`.
2. **Cada endpoint valida el rol en el backend**, nunca solo en el frontend
   (`requireAuth`/`requireRole` de `src/middlewares/auth.middleware.js` en cada ruta que
   lo necesite). El frontend oculta botones; el backend es quien de verdad decide.
3. **No exponer secretos** ni credenciales en código, logs o el repo. Las variables
   sensibles viven en `.env.dev`/`.env.test`/`.env.prod` (gitignored) — nunca en
   `resources/db/seed.sql` salvo el hash bcrypt ya fijo de las cuentas demo.
4. Los ids son **UUID generados en la aplicación** (`randomUUID()` de `node:crypto`),
   nunca con una función de la base de datos — evita depender de extensiones de
   Postgres (pgcrypto/uuid-ossp) que quizá no estén habilitadas en el entorno de destino.
5. Todo error se propaga con `next(error)` (o lanzando un `ApiError`) al `errorHandler`
   centralizado de `src/helpers/errorHandler.js`. Ningún módulo responde sus propios
   errores 500 a mano ni usa `console.log`/`console.error` para algo que debería quedar
   en la bitácora (`src/config/logger.js`, Winston).

## Arquitectura: módulos por dominio

Todo el desarrollo va en `src/modules/<nombre>/`, un módulo por dominio del sistema
(auth, citas, clientes, servicios, inventario, reportes, notificaciones). No existe
código "legacy" en este repo — es un proyecto nuevo, no hay nada que migrar.

### Estructura de un módulo

```
src/modules/<recurso>/
  <recurso>.routes.js      # Router de Express (export default)
  <recurso>.controller.js  # Traduce HTTP ↔ service. Composition root del módulo.
  <recurso>.service.js     # Lógica/orquestación. Factory: createXService({ repository })
  <recurso>.repository.js  # Único lugar con acceso a datos (SQL parametrizado vía src/config/db.js)
  <recurso>.schema.js      # Validación de entrada con Ajv (src/helpers/validate.js)
```

Las rutas se montan solas: `src/modules/index.js` escanea recursivamente los
`*.routes.js` y arma el prefijo URL con el nombre de la carpeta (`/api/servicios`,
`/api/citas`, ...). No hay que registrar nada manualmente. Una carpeta llamada `shared/`
se ignoraría en el escaneo si alguna vez hace falta (helpers internos de un dominio que
no son, ellos mismos, un módulo montable).

**Módulo de referencia: `src/modules/servicios/`.** Está completo — cópialo como
plantilla antes de escribir un módulo nuevo desde cero.

### SOLID aplicado a este proyecto

- **S**: el controller solo traduce HTTP, el service solo tiene lógica de negocio, el
  repository solo tiene acceso a datos. Si una función hace dos de esas cosas, está mal
  ubicada.
- **O/D**: los services se construyen con una factory que recibe sus dependencias
  (`createServiciosService({ repository })`), nunca importan su propio repositorio a
  ciegas — así se puede sustituir el repositorio (por ejemplo, uno en memoria) sin tocar
  la lógica de negocio.
- Nada de queries SQL en controllers o services; nada de lógica de negocio en el
  controller ni en el repository.

## Base de datos: sin ORM, con migraciones versionadas

- Esquema versionado en [resources/db/migrations/](./resources/db/migrations) — un
  archivo `NNNN_descripcion.sql` por migración, DDL plano e idempotente
  (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`). Si cambia el modelo de
  datos, **se agrega un archivo nuevo** (`0005_...sql`), nunca se edita uno ya aplicado
  en algún ambiente compartido.
- `scripts/db/migrate.mjs` (`runMigrations()`) aplica, en orden y dentro de una
  transacción por archivo, solo las migraciones que todavía no estén registradas en la
  tabla `schema_migrations` (una fila por archivo aplicado, con `version` = nombre del
  archivo). Es lo que hace que sean "versionadas": el estado real de cada entorno
  (dev/test/prod) queda en esa tabla, no en la memoria de quien las corrió.
- Datos de ejemplo: [resources/db/seed.sql](./resources/db/seed.sql), con
  `ON CONFLICT DO NOTHING` para poder reaplicarse sin duplicar. No es una migración (no
  se versiona en `schema_migrations`): es data de demo, se omite en producción
  (`--no-seed` o `NODE_ENV=production`).
- `scripts/db/setup.mjs` crea la BD si hace falta, corre `runMigrations()` y siembra.
  Sin Docker: se asume un servidor Postgres ya instalado y corriendo.
- Transacciones: cuando una operación necesita más de un `INSERT`/`UPDATE` que deben
  confirmarse juntos o ninguno (el caso más claro: marcar una cita como atendida +
  descontar el insumo del inventario), usar `getClient()` de `src/config/db.js` con
  `BEGIN`/`COMMIT`/`ROLLBACK` explícitos — no dos llamadas sueltas a `query()`.

## Notificaciones y correo

`src/services/mailer.js` (transporte SMTP) y `src/services/notification.service.js`
(`notify()`) ya están implementados como infraestructura compartida — cualquier módulo
que necesite avisar algo por correo y dejarlo también en el centro de notificaciones del
usuario los reutiliza tal cual, en vez de reimplementar el envío de correo.

## Anti-patrones a evitar

- SQL armado con concatenación o template strings en vez de parámetros posicionales.
- Lógica de negocio dentro de un `*.controller.js` o un `*.routes.js`.
- Un módulo importando el repositorio de otro módulo directamente en vez de pasar por su
  `service` (si dos módulos necesitan compartir una operación, esa operación se expone
  como función del `service` del módulo dueño de los datos).
- `console.log`/`console.error` como mecanismo de error: todo error relevante va a la
  bitácora (Winston) a través del `errorHandler` central.
