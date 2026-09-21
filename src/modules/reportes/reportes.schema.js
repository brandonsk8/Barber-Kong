export const reporteQuerySchema = {
  type: 'object',
  properties: {
    tipo: { type: 'string', enum: ['citas', 'ingresos', 'insumos'] },
    formato: { type: 'string', enum: ['pdf', 'excel'] },
    desde: { type: 'string', format: 'date' },
    hasta: { type: 'string', format: 'date' },
  },
  required: ['tipo', 'formato', 'desde', 'hasta'],
  additionalProperties: false,
  errorMessage: {
    required: {
      tipo: 'Debes indicar el tipo de reporte (citas, ingresos o insumos).',
      formato: 'Debes indicar el formato de exportación (pdf o excel).',
      desde: 'Debes indicar la fecha de inicio del rango.',
      hasta: 'Debes indicar la fecha de fin del rango.',
    },
    properties: {
      tipo: 'El tipo de reporte debe ser citas, ingresos o insumos.',
      formato: 'El formato debe ser pdf o excel.',
    },
  },
};
