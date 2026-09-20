export const createBarberoSchema = {
  type: 'object',
  properties: {
    nombre: { type: 'string', minLength: 1, maxLength: 255 },
    especialidad: { type: 'string', maxLength: 255 },
    email: { type: 'string', format: 'email', maxLength: 255 },
    password: { type: 'string', minLength: 8, maxLength: 72 },
  },
  required: ['nombre', 'email', 'password'],
  additionalProperties: false,
};

export const updateBarberoSchema = {
  type: 'object',
  properties: {
    nombre: { type: 'string', minLength: 1, maxLength: 255 },
    especialidad: { type: 'string', maxLength: 255 },
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
