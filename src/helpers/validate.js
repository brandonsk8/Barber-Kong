// Validación de entrada compartida por todos los módulos (`*.schema.js` de cada uno
// define el JSON Schema; este helper lo compila y lo aplica). Centralizado para que
// todos los módulos devuelvan errores 400 con el mismo formato.
import Ajv from 'ajv';
import ajvErrors from 'ajv-errors';
import addFormats from 'ajv-formats';
import { ApiError } from './ApiError.js';

const ajv = new Ajv({ allErrors: true, coerceTypes: true });
addFormats(ajv);
ajvErrors(ajv);

const compiledCache = new Map();

function compile(schema) {
  if (!compiledCache.has(schema)) {
    compiledCache.set(schema, ajv.compile(schema));
  }
  return compiledCache.get(schema);
}

// Uso típico en un controller: const data = validate(createServicioSchema, req.body);
export function validate(schema, data) {
  const validateFn = compile(schema);
  if (!validateFn(data)) {
    const message = validateFn.errors.map((e) => `${e.instancePath || e.schemaPath} ${e.message}`).join('; ');
    throw ApiError.badRequest(message);
  }
  return data;
}
