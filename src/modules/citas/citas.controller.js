import * as repository from './citas.repository.js';
import { createCitasService } from './citas.service.js';
import { crearCitaSchema, reprogramarCitaSchema, crearWalkinSchema } from './citas.schema.js';
import { validate } from '../../helpers/validate.js';
import { ApiError } from '../../helpers/ApiError.js';

const service = createCitasService({ repository });

export async function crear(req, res, next) {
  try {
    const data = validate(crearCitaSchema, req.body);
    const cita = await service.crear({
      userId: req.user.id,
      servicioId: data.servicio_id,
      barberoId: data.barbero_id,
      fecha: data.fecha,
      horaInicio: data.hora_inicio,
    });
    res.status(201).json(cita);
  } catch (err) {
    next(err);
  }
}

export async function crearWalkin(req, res, next) {
  try {
    const data = validate(crearWalkinSchema, req.body);
    const cita = await service.crearWalkin({
      barberoId: data.barbero_id,
      servicioId: data.servicio_id,
      fecha: data.fecha,
      horaInicio: data.hora_inicio,
      nombreCliente: data.nombre_cliente,
    });
    res.status(201).json(cita);
  } catch (err) {
    next(err);
  }
}

export async function misCitas(req, res, next) {
  try {
    res.json(await service.misCitas(req.user.id));
  } catch (err) {
    next(err);
  }
}

export async function reprogramar(req, res, next) {
  try {
    const data = validate(reprogramarCitaSchema, req.body);
    const cita = await service.reprogramar(
      req.params.id,
      { fecha: data.fecha, horaInicio: data.hora_inicio },
      req.user
    );
    res.json(cita);
  } catch (err) {
    next(err);
  }
}

export async function cancelar(req, res, next) {
  try {
    res.json(await service.cancelar(req.params.id, req.user));
  } catch (err) {
    next(err);
  }
}

export async function marcarAtendida(req, res, next) {
  try {
    res.json(await service.marcarAtendida(req.params.id));
  } catch (err) {
    next(err);
  }
}

// GET /api/citas?barbero_id=&fecha=            -> agenda de un día (barbero/admin)
// GET /api/citas?desde=&hasta=[&barbero_id=]    -> listado por rango (admin)
export async function listar(req, res, next) {
  try {
    const { barbero_id: barberoId, fecha, desde, hasta } = req.query;
    if (barberoId && fecha) {
      return res.json(await service.agendaDelDia(barberoId, fecha));
    }
    if (!desde || !hasta) {
      throw ApiError.badRequest('Especificá barbero_id+fecha, o desde+hasta.');
    }
    res.json(await service.listarPorRango({ desde, hasta, barberoId }));
  } catch (err) {
    next(err);
  }
}
