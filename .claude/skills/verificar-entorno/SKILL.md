---
name: verificar-entorno
description: Levantar Barber Kong con Docker Compose y verificar de punta a punta que funciona (migraciones aplicadas, API sana, login, endpoints afectados por un cambio). Usar antes de dar por terminado un cambio o antes de una demo.
---

# Verificar el entorno completo

No hay suite de pruebas automatizada: la verificación es levantar el sistema y probarlo.

## 1. Levantar

```bash
docker compose up --build -d
docker compose ps -a
```

Esperado: `db` healthy, `migrate` **Exited (0)**, `api` healthy, `frontend` Up.
Si `migrate` falló: `docker compose logs migrate` (causas típicas: migración editada,
número repetido, SQL inválido). Si el puerto 3000 está ocupado:
`API_PORT=3020 VITE_API_URL=http://localhost:3020/api docker compose up --build -d`.

## 2. Base de datos

- Con el MCP `barberkong-db` (solo lectura): confirmar que `schema_migrations` tiene
  todas las migraciones del repo y que las tablas tocadas por el cambio existen.
- Alternativa sin MCP: `npm run db:status`.

## 3. API

```bash
curl -s http://localhost:3000/api/health
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@barberkong.com","password":"BarberKong2026!"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')
```

(Credenciales demo de `resources/db/seed.sql`; solo existen en desarrollo.)

Para cada endpoint afectado probar: caso feliz, sin token (401), rol incorrecto (403
— usar un barbero demo, p. ej. `jose.m@barberkong.com`), body inválido (400 con mensaje
en español), id inexistente (404).

## 4. Frontend

Abrir `http://localhost:5173` y recorrer el flujo afectado; para revisar responsive,
usar la skill `revisar-ui`.

## 5. Reportar

Lista corta de lo probado y su resultado. Si algo falló, decirlo con la salida real —
no darlo por terminado.
