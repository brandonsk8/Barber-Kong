export const createClienteSchema = {
  type: 'object',
  properties: {
    nombre: { type: 'string', minLength: 1, maxLength: 255 },
    telefono: { type: 'string', maxLength: 50 },
    correo: { type: 'string', format: 'email', maxLength: 255 },
  },
  required: ['nombre'],
  additionalProperties: false,
};

export const updateClienteSchema = {
  type: 'object',
  properties: {
    nombre: { type: 'string', minLength: 1, maxLength: 255 },
    telefono: { type: 'string', maxLength: 50 },
    correo: { type: 'string', format: 'email', maxLength: 255 },
  },
  additionalProperties: false,
};
