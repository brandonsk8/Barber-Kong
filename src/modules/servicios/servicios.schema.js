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
