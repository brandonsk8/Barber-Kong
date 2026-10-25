const horaPattern = '^([01][0-9]|2[0-3]):[0-5][0-9]$';

// Un bloque de atención: día de la semana (0 = domingo ... 6 = sábado) y rango de horas.
// Un barbero puede tener varios bloques el mismo día (p. ej. mañana y tarde).
const bloqueHorarioSchema = {
  type: 'object',
  properties: {
    dia_semana: {
      type: 'integer',
      minimum: 0,
      maximum: 6,
      errorMessage: 'El día debe ser un número de 0 (domingo) a 6 (sábado).',
    },
    hora_inicio: {
      type: 'string',
      pattern: horaPattern,
      errorMessage: 'La hora de inicio debe tener el formato HH:MM (por ejemplo 09:00).',
    },
    hora_fin: {
      type: 'string',
      pattern: horaPattern,
      errorMessage: 'La hora de fin debe tener el formato HH:MM (por ejemplo 18:00).',
    },
  },
  required: ['dia_semana', 'hora_inicio', 'hora_fin'],
  additionalProperties: false,
  errorMessage: {
    required: {
      dia_semana: 'Falta el día de la semana.',
      hora_inicio: 'Falta la hora de inicio.',
      hora_fin: 'Falta la hora de fin.',
    },
  },
};

const horarioSchema = {
  type: 'array',
  items: bloqueHorarioSchema,
  minItems: 1,
  maxItems: 28,
  errorMessage: 'El horario debe tener entre 1 y 28 bloques de atención.',
};

export const createBarberoSchema = {
  type: 'object',
  properties: {
    nombre: { type: 'string', minLength: 1, maxLength: 255 },
    especialidad: { type: 'string', maxLength: 255 },
    email: { type: 'string', format: 'email', maxLength: 255 },
    password: { type: 'string', minLength: 8, maxLength: 72 },
    // Opcional: si no se manda, se usa el horario por defecto de la barbería.
    horario: horarioSchema,
  },
  required: ['nombre', 'email', 'password'],
  additionalProperties: false,
};

export const updateBarberoSchema = {
  type: 'object',
  properties: {
    nombre: { type: 'string', minLength: 1, maxLength: 255 },
    especialidad: { type: 'string', maxLength: 255 },
    // Si viene, REEMPLAZA todo el horario semanal del barbero.
    horario: horarioSchema,
  },
  additionalProperties: false,
};

export const disponibilidadQuerySchema = {
  type: 'object',
  properties: {
    fecha: { type: 'string', format: 'date' },
  },
  required: ['fecha'],
  additionalProperties: true,
};

export const crearAusenciaSchema = {
  type: 'object',
  properties: {
    fecha: { type: 'string', format: 'date', errorMessage: 'La fecha debe tener el formato AAAA-MM-DD.' },
    motivo: { type: 'string', maxLength: 255, errorMessage: 'El motivo no puede pasar de 255 caracteres.' },
  },
  required: ['fecha'],
  additionalProperties: false,
  errorMessage: {
    required: { fecha: 'Debes indicar el día en que no estarás disponible.' },
  },
};
