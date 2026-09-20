-- Barber Kong — esquema de base de datos (PostgreSQL)
--
-- Fuente única de verdad del esquema. Sin ORM: los ids (UUID) se generan en la
-- aplicación con el paquete `uuid` antes de insertar, así que las tablas no llevan
-- DEFAULT para `id` (evita depender de extensiones como pgcrypto/uuid-ossp).
--
-- Aplicar con: npm run db:setup   (ver scripts/db/setup.mjs)
-- Este archivo es idempotente: se puede correr varias veces sin duplicar nada.

CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY,
  email               VARCHAR(255) NOT NULL UNIQUE,
  password_hash       VARCHAR(255) NOT NULL,
  role                VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'barbero', 'cliente')),
  two_factor_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clientes (
  id          UUID PRIMARY KEY,
  -- Nulo para clientes walk-in registrados por el administrador sin cuenta propia (UC-08/UC-25).
  user_id     UUID UNIQUE REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  nombre      VARCHAR(255) NOT NULL,
  telefono    VARCHAR(50),
  correo      VARCHAR(255),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS barberos (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL UNIQUE REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  nombre       VARCHAR(255) NOT NULL,
  especialidad VARCHAR(255),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Horario por barbero, día de semana (0=domingo .. 6=sábado). El horario global de la
-- barbería (domingo-jueves, 9:00-19:00, receso 13:00-14:00) es la regla por defecto al
-- crear un barbero; esta tabla permite ajustarlo por persona (UC-22/UC-23).
CREATE TABLE IF NOT EXISTS disponibilidad_barberos (
  id          UUID PRIMARY KEY,
  barbero_id  UUID NOT NULL REFERENCES barberos(id) ON UPDATE CASCADE ON DELETE CASCADE,
  dia_semana  SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fin    TIME NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disponibilidad_barbero_dia ON disponibilidad_barberos (barbero_id, dia_semana);

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

CREATE TABLE IF NOT EXISTS notificaciones (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  tipo        VARCHAR(30) NOT NULL CHECK (tipo IN (
                'dos_factor', 'recuperacion_password', 'confirmacion_cita',
                'reprogramacion_cita', 'cancelacion_cita', 'alerta_inventario'
              )),
  titulo      VARCHAR(255) NOT NULL,
  mensaje     TEXT NOT NULL,
  leida       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notificaciones_user_leida ON notificaciones (user_id, leida);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens (user_id);

CREATE TABLE IF NOT EXISTS two_factor_codes (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  code_hash   VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_two_factor_codes_user ON two_factor_codes (user_id);
