---
name: nueva-migracion
description: Crear un cambio de esquema de la base de datos de Barber Kong como migración versionada (tabla nueva, columna, índice, restricción). Usar siempre que haya que tocar el modelo de datos.
---

# Nueva migración versionada

El esquema vive en `resources/db/migrations/NNNN_descripcion.sql` y lo aplica
`scripts/db/migrate.mjs` (registro en `schema_migrations` con checksum SHA-256).

## Pasos

1. Ver el estado actual antes de tocar nada: `npm run db:status` (o la tool
   `list_objects` / `get_object_details` del MCP `barberkong-db` para ver tablas y
   columnas reales).
2. Crear el archivo con el siguiente número: `npm run db:new -- <descripcion>`.
   **Nunca** inventar el número ni renombrar a mano.
3. Escribir DDL **idempotente** en el archivo generado:
   - `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `DROP ... IF EXISTS`.
   - Restricciones con nombre explícito; para agregarlas de forma idempotente usar un
     bloque `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`.
   - Ids `UUID` **sin** `DEFAULT gen_random_uuid()`: los genera la app con
     `randomUUID()` (regla dura 4 de CLAUDE.md).
   - Claves foráneas con `ON UPDATE CASCADE` y el `ON DELETE` que corresponda a la regla
     de negocio (ver migraciones 0001–0004 como referencia de estilo).
   - Nada de `CREATE INDEX CONCURRENTLY` ni `BEGIN/COMMIT` propios: el runner ya envuelve
     cada archivo en una transacción.
4. Aplicar: `npm run db:migrate` (local) o `docker compose up` (Docker monta
   `resources/db`, no hace falta rebuild).
5. Verificar con `npm run db:status` y, con el MCP `barberkong-db`, que la tabla/columna
   exista con los tipos esperados.
6. Si la migración agrega columnas que el seed demo debería llenar, actualizar
   `resources/db/seed.sql` (con `ON CONFLICT DO NOTHING`).

## Prohibido

- Editar una migración ya aplicada en develop/main. El runner la rechaza con
  "Migraciones ya aplicadas fueron editadas". La corrección es **otra** migración.
- Dos migraciones con el mismo número: si al sincronizar con `develop` aparece un
  número repetido, renumerar la propia (la más nueva) antes de mergear.
