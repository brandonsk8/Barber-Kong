import * as repository from './servicios.repository.js';
import { createServiciosService } from './servicios.service.js';
import { createServicioSchema, updateServicioSchema } from './servicios.schema.js';
import { validate } from '../../helpers/validate.js';

// Composition root del módulo: aquí se arma el service con su repositorio real.
// El controller solo traduce HTTP <-> service; nada de SQL ni de reglas de negocio aquí.
const service = createServiciosService({ repository });

export async function list(req, res, next) {
  try {
    res.json(await service.listActive());
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    res.json(await service.getById(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const data = validate(createServicioSchema, req.body);
    res.status(201).json(await service.create(data));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const data = validate(updateServicioSchema, req.body);
    res.json(await service.update(req.params.id, data));
  } catch (err) {
    next(err);
  }
}

export async function deactivate(req, res, next) {
  try {
    res.json(await service.deactivate(req.params.id));
  } catch (err) {
    next(err);
  }
}
