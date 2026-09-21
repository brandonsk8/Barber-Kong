-- Migración 0004: notificaciones y tablas de seguridad (recuperación de contraseña,
-- códigos de doble factor).

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
