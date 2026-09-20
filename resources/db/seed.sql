-- Barber Kong — datos de ejemplo (desarrollo/pruebas)
--
-- Contraseña para todas las cuentas de ejemplo: BarberKong2026!
-- (hash bcrypt precalculado, costo 10 — ver resources/db/README.md para regenerarlo)
--
-- Usa ids fijos e `ON CONFLICT DO NOTHING` para poder correrse varias veces sin duplicar.
-- Catálogo e integrantes tomados tal cual del mockup de landing page de Fase 1.

-- Usuarios ------------------------------------------------------------------
INSERT INTO users (id, email, password_hash, role, two_factor_enabled, is_active) VALUES
  ('2bec9e24-2bb9-46d8-bdfd-2d7fa715209c', 'admin@barberkong.com', '$2b$10$SZrjXb3cOTXV1AfVOM8uxOyL10mdNRR345DZ3mCwTYpK/20hEjpU.', 'admin', FALSE, TRUE),
  ('dc8c9add-4eb2-4caf-b90f-66d961ae9003', 'jose.m@barberkong.com', '$2b$10$SZrjXb3cOTXV1AfVOM8uxOyL10mdNRR345DZ3mCwTYpK/20hEjpU.', 'barbero', FALSE, TRUE),
  ('ec00caa0-44aa-4d32-b54a-6f51f7dfde1d', 'luis.r@barberkong.com', '$2b$10$SZrjXb3cOTXV1AfVOM8uxOyL10mdNRR345DZ3mCwTYpK/20hEjpU.', 'barbero', FALSE, TRUE),
  ('6bd41097-a0e5-460b-b4ad-c17d71904e00', 'diego.c@barberkong.com', '$2b$10$SZrjXb3cOTXV1AfVOM8uxOyL10mdNRR345DZ3mCwTYpK/20hEjpU.', 'barbero', FALSE, TRUE),
  ('22c42069-fa23-470c-aba4-372612c0e76e', 'ana.v@barberkong.com', '$2b$10$SZrjXb3cOTXV1AfVOM8uxOyL10mdNRR345DZ3mCwTYpK/20hEjpU.', 'barbero', FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Barberos --------------------------------------------------------------------
INSERT INTO barberos (id, user_id, nombre, especialidad, is_active) VALUES
  ('cfcaec7d-c9f5-4af2-9e44-592ca38b8f58', 'dc8c9add-4eb2-4caf-b90f-66d961ae9003', 'José M.', 'Cortes clásicos', TRUE),
  ('9a41bb8f-b05a-4e2d-92ce-15fa78772587', 'ec00caa0-44aa-4d32-b54a-6f51f7dfde1d', 'Luis R.', 'Barba y afeitado', TRUE),
  ('e23688e1-cedb-4172-86dc-0be0c8a6e504', '6bd41097-a0e5-460b-b4ad-c17d71904e00', 'Diego C.', 'Diseños y fade', TRUE),
  ('67bcb40a-fc3a-4bd5-8486-1f14f814b4e0', '22c42069-fa23-470c-aba4-372612c0e76e', 'Ana V.', 'Corte infantil', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Disponibilidad: domingo(0) a jueves(4), 9:00-19:00 para los 4 barberos demo.
-- El receso de almuerzo (13:00-14:00) es una regla global que valida el módulo de citas,
-- no una fila aparte aquí.
INSERT INTO disponibilidad_barberos (id, barbero_id, dia_semana, hora_inicio, hora_fin)
SELECT gen_ids.id, b.barbero_id, dias.dia, '09:00', '19:00'
FROM (VALUES
  ('cfcaec7d-c9f5-4af2-9e44-592ca38b8f58'::uuid),
  ('9a41bb8f-b05a-4e2d-92ce-15fa78772587'::uuid),
  ('e23688e1-cedb-4172-86dc-0be0c8a6e504'::uuid),
  ('67bcb40a-fc3a-4bd5-8486-1f14f814b4e0'::uuid)
) AS b(barbero_id)
CROSS JOIN (VALUES (0), (1), (2), (3), (4)) AS dias(dia)
CROSS JOIN LATERAL (SELECT md5(b.barbero_id || '-' || dias.dia)::uuid AS id) AS gen_ids
ON CONFLICT (id) DO NOTHING;

-- Servicios (catálogo del mockup de landing page) ------------------------------
INSERT INTO servicios (id, nombre, duracion_minutos, precio, is_active) VALUES
  ('b0fb1cbe-2482-4653-ba7e-e96f04ae488f', 'Corte clásico', 30, 45, TRUE),
  ('b88da814-eacf-4e65-b015-85a229db1703', 'Arreglo de barba', 20, 35, TRUE),
  ('2ed68a62-fa8d-43f7-b152-e1b58676ecb7', 'Combo corte + barba', 46, 70, TRUE),
  ('96d0d62a-bcc2-422a-9330-63cfd16b5cfe', 'Afeitado clásico', 38, 40, TRUE),
  ('214d1883-2229-4bb0-a645-65db5c835497', 'Corte niño', 20, 35, TRUE),
  ('22027b15-1250-435d-b523-0b302be9a2cd', 'Diseño / línea', 15, 20, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Insumos (mencionados en la definición del problema de Fase 1) ----------------
INSERT INTO insumos (id, nombre, unidad_medida, cantidad_disponible, cantidad_minima) VALUES
  ('d0ac01a8-76b4-41f2-9c7a-18eee237e145', 'Shampoo', 'ml', 5000, 500),
  ('4c23b7f0-b512-45d2-86a0-f190f075bcf8', 'Gel', 'ml', 3000, 300),
  ('94eca788-5b0b-4e14-ac41-f0e765551520', 'Cuchillas', 'unidad', 100, 10),
  ('960f638d-d957-46d0-aa9f-7bb30bdbf870', 'Tinte', 'ml', 2000, 200)
ON CONFLICT (id) DO NOTHING;
