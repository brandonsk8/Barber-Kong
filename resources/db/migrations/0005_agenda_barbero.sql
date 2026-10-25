-- Agenda del barbero: (1) integridad del horario semanal y (2) días en que no atiende.

-- (1) Un bloque de horario siempre debe terminar después de empezar. Antes solo lo
-- garantizaba la aplicación; ahora también la base (UC-22/UC-23).
DO $$ BEGIN
  ALTER TABLE disponibilidad_barberos
    ADD CONSTRAINT chk_disponibilidad_horas CHECK (hora_fin > hora_inicio);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- (2) Días puntuales en que un barbero avisa que no estará disponible (día completo).
-- Mientras exista la fila, no se le pueden agendar citas ese día. Se borra el registro
-- para volver a habilitarlo; si se elimina el barbero se van con él.
CREATE TABLE IF NOT EXISTS ausencias_barbero (
  id          UUID PRIMARY KEY,
  barbero_id  UUID NOT NULL REFERENCES barberos(id) ON UPDATE CASCADE ON DELETE CASCADE,
  fecha       DATE NOT NULL,
  motivo      VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Un barbero no puede marcar dos veces el mismo día; además sirve de índice para la
  -- consulta "¿está ausente el barbero X en la fecha Y?" que hace cada agendamiento.
  CONSTRAINT uq_ausencia_barbero_fecha UNIQUE (barbero_id, fecha)
);
