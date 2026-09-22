export const createServicioSchema = {
  type: 'object',
  properties: {
    nombre: { type: 'string', minLength: 1, maxLength: 255 },
    duracion_minutos: { type: 'integer', minimum: 1 },
    precio: { type: 'number', minimum: 0 },
  },
  required: ['nombre', 'duracion_minutos', 'precio'],
  additionalProperties: false,
  errorMessage: {
    required: {
      nombre: 'El nombre del servicio es obligatorio.',
      duracion_minutos: 'La duración estimada (en minutos) es obligatoria.',
      precio: 'El precio es obligatorio.',
    },
  },
};

export const updateServicioSchema = {
  type: 'object',
  properties: {
    nombre: { type: 'string', minLength: 1, maxLength: 255 },
    duracion_minutos: { type: 'integer', minimum: 1 },
    precio: { type: 'number', minimum: 0 },
  },
  additionalProperties: false,
};

// UC-13
export const asociarInsumoSchema = {
  type: 'object',
  properties: {
    insumo_id: { type: 'string', format: 'uuid' },
    cantidad_consumida: { type: 'number', exclusiveMinimum: 0 },
  },
  required: ['insumo_id', 'cantidad_consumida'],
  additionalProperties: false,
  errorMessage: {
    required: {
      insumo_id: 'Debes indicar qué insumo se asocia.',
      cantidad_consumida: 'Debes indicar cuánto consume el servicio de ese insumo.',
    },
    properties: {
      cantidad_consumida: 'La cantidad debe ser un número mayor que cero.',
    },
  },
};
