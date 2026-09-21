-- Migración 0003: citas y el historial de movimientos de inventario que genera
-- el "proceso complejo" (cita atendida -> descuento de insumo -> alerta de stock bajo).

CREATE TABLE IF NOT EXISTS citas (
  id            UUID PRIMARY KEY,
  -- Nulo en citas walk-in anónimas (UC-25) donde no se asocia un cliente registrado.
  cliente_id    UUID REFERENCES clientes(id) ON UPDATE CASCADE ON DELETE SET NULL,
  barbero_id    UUID NOT NULL REFERENCES barberos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  servicio_id   UUID NOT NULL REFERENCES servicios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  fecha         DATE NOT NULL,
  hora_inicio   TIME NOT NULL,
  -- Calculada al crear la cita a partir de la duración del servicio; se guarda para que
  -- la validación de doble reserva (RF-CIT-07) no dependa de un join adicional.
  hora_fin      TIME NOT NULL,
  estado        VARCHAR(20) NOT NULL DEFAULT 'confirmada'
                CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'atendida')),
  es_walkin     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_citas_barbero_fecha_hora ON citas (barbero_id, fecha, hora_inicio);
CREATE INDEX IF NOT EXISTS idx_citas_cliente ON citas (cliente_id);

-- Historial de entradas/salidas de inventario. Da soporte de auditoría a UC-15
-- (reabastecimiento) y UC-16 (descuento automático), y es la fuente del reporte de
-- consumo de insumos por periodo (RF-REP-03), que no se puede calcular solo con el
-- saldo actual en `insumos`.
CREATE TABLE IF NOT EXISTS insumo_movimientos (
  id          UUID PRIMARY KEY,
  insumo_id   UUID NOT NULL REFERENCES insumos(id) ON UPDATE CASCADE ON DELETE CASCADE,
  -- Presente solo en movimientos de tipo 'salida' generados por UC-16.
  cita_id     UUID REFERENCES citas(id) ON UPDATE CASCADE ON DELETE SET NULL,
  tipo        VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  cantidad    NUMERIC(10, 2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_insumo_movimientos_insumo_fecha ON insumo_movimientos (insumo_id, created_at);
