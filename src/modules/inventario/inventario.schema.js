export const createInsumoSchema = {
  type: 'object',
  properties: {
    nombre: { type: 'string', minLength: 1, maxLength: 255 },
    unidad_medida: { type: 'string', minLength: 1, maxLength: 50 },
    cantidad_minima: { type: ['number', 'null'], minimum: 0 },
  },
  required: ['nombre', 'unidad_medida'],
  additionalProperties: false,
};

export const updateInsumoSchema = {
  type: 'object',
  properties: {
    nombre: { type: 'string', minLength: 1, maxLength: 255 },
    unidad_medida: { type: 'string', minLength: 1, maxLength: 50 },
    cantidad_minima: { type: ['number', 'null'], minimum: 0 },
  },
  additionalProperties: false,
};

export const entradaSchema = {
  type: 'object',
  properties: {
    cantidad: { type: 'number', exclusiveMinimum: 0 },
  },
  required: ['cantidad'],
  additionalProperties: false,
};
