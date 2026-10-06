---
name: revisar-reglas
description: Revisar el diff actual (o una rama/PR) contra las reglas duras y la arquitectura de Barber Kong antes de commitear o aprobar un Pull Request.
---

# Revisión contra las reglas del proyecto

Obtener el diff: `git diff develop...HEAD` (o `git diff` si no hay commits aún). Revisar
**solo lo que cambió**, archivo por archivo, y reportar cada hallazgo como
`archivo:línea — regla — problema — corrección sugerida`.

## Checklist (de CLAUDE.md)

1. **SQL parametrizado**: ningún `${...}` dentro de un string que va a `query()` /
   `client.query()`. Única excepción conocida: `CREATE DATABASE` en `setup.mjs`, ya
   validado contra allowlist.
2. **Rol en backend**: toda ruta nueva no pública tiene `requireAuth` + `requireRole`.
   Verificar que el rol sea el correcto según el caso de uso (admin vs barbero vs
   cliente) y que un cliente no pueda leer/modificar datos de otro cliente (filtrar por
   `req.user.id` en el service).
3. **Secretos**: nada de credenciales, tokens o `.env.*` en el diff.
4. **UUID en la app**: `randomUUID()`, nunca `gen_random_uuid()`/`uuid_generate_v4()`.
5. **Errores**: `next(err)` / `ApiError`; sin `res.status(500)` manuales, sin
   `console.log`/`console.error` (usar `logger` de `src/config/logger.js`).
6. **Capas**: sin SQL en controller/service, sin lógica de negocio en
   controller/repository, sin importar el repository de otro módulo.
7. **Validación**: todo `req.body` pasa por `validate(schema, ...)`; schemas con
   `additionalProperties: false`.
8. **Transacciones**: operaciones de varios pasos que deben ir juntas usan
   `getClient()` + `BEGIN/COMMIT/ROLLBACK` + `release()` en `finally`.
9. **Migraciones**: ningún archivo de `resources/db/migrations/` existente fue
   modificado; los nuevos siguen la skill `nueva-migracion`.
10. **Rendimiento**: consultas nuevas en tablas grandes (`citas`, `notificaciones`)
    tienen índice para sus filtros. Si hay duda, usar `explain_query` o
    `analyze_query_indexes` del MCP `barberkong-db`.

Al final: resumen de 1–3 líneas con veredicto (listo / cambios necesarios). No aplicar
correcciones sin que el integrante lo pida.
