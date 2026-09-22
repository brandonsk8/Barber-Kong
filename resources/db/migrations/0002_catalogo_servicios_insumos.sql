-- Migración 0002: catálogo de servicios e insumos, y la asociación entre ambos
-- (UC-13, "qué insumos consume un servicio").

CREATE TABLE IF NOT EXISTS servicios (
  id                UUID PRIMARY KEY,
  nombre            VARCHAR(255) NOT NULL,
  duracion_minutos  INTEGER NOT NULL,
  precio            NUMERIC(10, 2) NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS insumos (
  id                    UUID PRIMARY KEY,
  nombre                VARCHAR(255) NOT NULL,
  unidad_medida         VARCHAR(50) NOT NULL,
  cantidad_disponible   NUMERIC(10, 2) NOT NULL DEFAULT 0,
  -- Nulo = sin mínimo configurado = el sistema no genera alerta (UC-17).
  cantidad_minima       NUMERIC(10, 2),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS servicio_insumos (
  id                  UUID PRIMARY KEY,
  servicio_id         UUID NOT NULL REFERENCES servicios(id) ON UPDATE CASCADE ON DELETE CASCADE,
  insumo_id           UUID NOT NULL REFERENCES insumos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  cantidad_consumida  NUMERIC(10, 2) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_servicio_insumo UNIQUE (servicio_id, insumo_id)
);
