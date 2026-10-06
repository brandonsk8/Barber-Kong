---
name: nuevo-modulo
description: Crear un módulo de dominio nuevo del backend (o un endpoint nuevo en uno existente) siguiendo el patrón routes → controller → service → repository → schema de src/modules/servicios.
---

# Nuevo módulo / endpoint del backend

Plantilla obligatoria: `src/modules/servicios/`. Leerla completa antes de escribir.

## Estructura

```
src/modules/<recurso>/
  <recurso>.routes.js      Router (export default). Se monta solo en /api/<recurso>.
  <recurso>.controller.js  Composition root: const service = createXService({ repository })
  <recurso>.service.js     export function createXService({ repository }) { return {...} }
  <recurso>.repository.js  Único lugar con SQL. Funciones exportadas sueltas.
  <recurso>.schema.js      JSON Schemas de Ajv con errorMessage en español.
```

No registrar rutas en ningún otro lado: `src/modules/index.js` las descubre.

## Reglas por capa

- **routes**: cada ruta que no sea pública lleva `requireAuth, requireRole('admin' |
  'barbero' | 'cliente')` de `src/middlewares/auth.middleware.js`. Comentar arriba qué
  épica/HU/UC cubre (ej. `// Dueño: EP-04 — ... (HU-16)`).
- **controller**: solo `validate(schema, req.body)` → llamar al service → `res.json`.
  Siempre `try { ... } catch (err) { next(err); }`. Nada de SQL ni reglas de negocio.
- **service**: lógica de negocio. Lanza `ApiError.notFound/badRequest/conflict/forbidden`
  (`src/helpers/ApiError.js`) con mensajes para el usuario final en español. Traduce
  códigos de Postgres cuando aplique (`23503` FK → badRequest, `23505` único → conflict).
- **repository**: `query('... $1, $2', [a, b])` de `src/config/db.js`. **Jamás**
  template strings con valores. Ids con `randomUUID()` de `node:crypto`.
  Operaciones con varios INSERT/UPDATE que van juntos → `getClient()` +
  `BEGIN`/`COMMIT`/`ROLLBACK` + `client.release()` en `finally`.
- **schema**: `additionalProperties: false`, `required` explícito, `format: 'uuid'`
  para ids.

## Si necesita datos de otro módulo

Llamar al **service** del módulo dueño (ver `inventario/inventario.instance.js` como
ejemplo de instancia compartida), nunca importar su repository.

## Si necesita correo/notificación

Reusar `notify()` de `src/services/notification.service.js`.

## Al terminar

1. `node --check` sobre cada archivo nuevo.
2. Si hace falta tabla nueva → skill `nueva-migracion`.
3. Probar con la skill `verificar-entorno` (endpoint con y sin token, rol incorrecto → 403).
4. Pasar la skill `revisar-reglas` sobre el diff.
