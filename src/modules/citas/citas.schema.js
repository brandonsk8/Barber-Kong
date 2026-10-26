const horaPattern = '^([01][0-9]|2[0-3]):[0-5][0-9]$';

export const crearCitaSchema = {
  type: 'object',
  properties: {
    servicio_id: { type: 'string', format: 'uuid' },
    barbero_id: { type: 'string', format: 'uuid' },
    fecha: { type: 'string', format: 'date' },
    hora_inicio: { type: 'string', pattern: horaPattern },
  },
  required: ['servicio_id', 'barbero_id', 'fecha', 'hora_inicio'],
  additionalProperties: false,
  errorMessage: {
    properties: {
      hora_inicio: 'La hora debe tener el formato HH:MM.',
    },
  },
};

export const reprogramarCitaSchema = {
  type: 'object',
  properties: {
    fecha: { type: 'string', format: 'date' },
    hora_inicio: { type: 'string', pattern: horaPattern },
  },
  required: ['fecha', 'hora_inicio'],
  additionalProperties: false,
};

export const crearWalkinSchema = {
  type: 'object',
  properties: {
    servicio_id: { type: 'string', format: 'uuid' },
    barbero_id: { type: 'string', format: 'uuid' },
    fecha: { type: 'string', format: 'date' },
    hora_inicio: { type: 'string', pattern: horaPattern },
    nombre_cliente: { type: 'string', maxLength: 255 },
  },
  required: ['servicio_id', 'barbero_id', 'fecha', 'hora_inicio'],
  additionalProperties: false,
};

// GET /api/citas: barbero_id+fecha (agenda de un día) o desde+hasta (rango).
export const listarCitasQuerySchema = {
  type: 'object',
  properties: {
    barbero_id: { type: 'string', format: 'uuid', errorMessage: 'barbero_id debe ser un identificador válido.' },
    fecha: { type: 'string', format: 'date', errorMessage: 'La fecha debe tener el formato AAAA-MM-DD.' },
    desde: { type: 'string', format: 'date', errorMessage: 'La fecha inicial debe tener el formato AAAA-MM-DD.' },
    hasta: { type: 'string', format: 'date', errorMessage: 'La fecha final debe tener el formato AAAA-MM-DD.' },
  },
  additionalProperties: true,
};
