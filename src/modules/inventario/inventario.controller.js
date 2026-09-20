import { createInsumoSchema, updateInsumoSchema, entradaSchema } from './inventario.schema.js';
import { validate } from '../../helpers/validate.js';
import { inventarioService as service } from './inventario.instance.js';

export async function list(req, res, next) {
  try {
    res.json(await service.list());
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const data = validate(createInsumoSchema, req.body);
    res.status(201).json(await service.create(data));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const data = validate(updateInsumoSchema, req.body);
    res.json(await service.update(req.params.id, data));
  } catch (err) {
    next(err);
  }
}

export async function registrarEntrada(req, res, next) {
  try {
    const { cantidad } = validate(entradaSchema, req.body);
    res.json(await service.registrarEntrada(req.params.id, cantidad));
  } catch (err) {
    next(err);
  }
}
