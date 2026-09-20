import { createBarberoSchema, updateBarberoSchema, disponibilidadQuerySchema } from './barberos.schema.js';
import { validate } from '../../helpers/validate.js';
import { barberosService as service } from './barberos.instance.js';

// Pública (RF-SER-03 aplicado igual a barberos: el cliente debe verlos al agendar,
// sin necesidad de login).
export async function list(req, res, next) {
  try {
    res.json(await service.listActive());
  } catch (err) {
    next(err);
  }
}

// Solo administrador: incluye barberos inactivos, para poder reactivarlos.
export async function listAll(req, res, next) {
  try {
    res.json(await service.listAll());
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

export async function getDisponibilidad(req, res, next) {
  try {
    const { fecha } = validate(disponibilidadQuerySchema, req.query);
    res.json(await service.getDisponibilidad(req.params.id, fecha));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const data = validate(createBarberoSchema, req.body);
    res.status(201).json(await service.create(data));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const data = validate(updateBarberoSchema, req.body);
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
