import * as repository from './clientes.repository.js';
import { createClientesService } from './clientes.service.js';
import { createClienteSchema, updateClienteSchema } from './clientes.schema.js';
import { validate } from '../../helpers/validate.js';

const service = createClientesService({ repository });

export async function list(req, res, next) {
  try {
    res.json(await service.list(req.query.search));
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
    const data = validate(createClienteSchema, req.body);
    res.status(201).json(await service.create(data));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const data = validate(updateClienteSchema, req.body);
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

export async function activate(req, res, next) {
  try {
    res.json(await service.activate(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function historial(req, res, next) {
  try {
    res.json(await service.historial(req.params.id));
  } catch (err) {
    next(err);
  }
}
