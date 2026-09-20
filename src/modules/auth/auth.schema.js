export const registerSchema = {
  type: 'object',
  properties: {
    nombre: { type: 'string', minLength: 1, maxLength: 255 },
    email: { type: 'string', format: 'email', maxLength: 255 },
    telefono: { type: 'string', maxLength: 50 },
    password: { type: 'string', minLength: 8, maxLength: 72 },
  },
  required: ['nombre', 'email', 'password'],
  additionalProperties: false,
  errorMessage: {
    required: {
      nombre: 'El nombre es obligatorio.',
      email: 'El correo es obligatorio.',
      password: 'La contraseña es obligatoria (mínimo 8 caracteres).',
    },
  },
};

export const loginSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 1 },
  },
  required: ['email', 'password'],
  additionalProperties: false,
};

export const verifyTwoFactorSchema = {
  type: 'object',
  properties: {
    userId: { type: 'string', format: 'uuid' },
    code: { type: 'string', pattern: '^[0-9]{6}$' },
  },
  required: ['userId', 'code'],
  additionalProperties: false,
  errorMessage: {
    properties: {
      code: 'El código debe tener 6 dígitos.',
    },
  },
};

export const forgotPasswordSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
  },
  required: ['email'],
  additionalProperties: false,
};

export const resetPasswordSchema = {
  type: 'object',
  properties: {
    token: { type: 'string', minLength: 10 },
    password: { type: 'string', minLength: 8, maxLength: 72 },
  },
  required: ['token', 'password'],
  additionalProperties: false,
};
