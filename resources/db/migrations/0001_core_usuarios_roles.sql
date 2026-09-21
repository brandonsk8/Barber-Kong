-- Migración 0001: núcleo de usuarios y roles (autenticación, clientes, barberos,
-- disponibilidad). Todo lo demás depende de estas tablas vía FK.

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
