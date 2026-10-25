// Defectos de control de acceso detectados por las pruebas y aún sin corregir. Cada caso
// describe el comportamiento CORRECTO esperado y usa `it.fails`: mientras el defecto
// exista la prueba "pasa" (falla como se espera) y el CI sigue en verde; cuando se
// corrija, la prueba empezará a fallar con "Expect test to fail" y habrá que cambiar
// `it.fails` por `it`. Se documentan en el Plan de Pruebas como H-03 a H-09.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { getApp, crearUsuario, crearServicio, crearInsumo, login, fechaEn, cerrar } from '../helpers/fixtures.js';

let api, hAdmin, hCliente, barbero1, barbero2, duenio, h2, servicio;

beforeAll(async () => {
  api = request(await getApp());
  const [admin, cliente, b1, b2, b3] = await Promise.all(['admin', 'cliente', 'barbero', 'barbero', 'barbero'].map((role) => crearUsuario({ role })));
  barbero1 = b1; // lo desactiva H-03
  barbero2 = b2; // el barbero que intenta ver la agenda ajena (H-04)
  duenio = b3; // dueño de la agenda consultada en H-04
  [hAdmin, hCliente, h2] = await Promise.all([admin, cliente, b2].map(login));
  servicio = await crearServicio();
});
afterAll(cerrar);

describe('defectos conocidos de control de acceso', () => {
  it.fails('[DEFECTO CONOCIDO H-03] un barbero desactivado por el administrador ya no puede iniciar sesión', async () => {
    await api.delete(`/api/barberos/${barbero1.perfilId}`).set(hAdmin).expect(200);

    const res = await api.post('/api/auth/login').send({ email: barbero1.email, password: barbero1.password });
    expect(res.status).toBe(401);
  });

  it.fails('[DEFECTO CONOCIDO H-04] un barbero no puede consultar la agenda ni las citas de otro barbero', async () => {
    const fecha = fechaEn(120);
    await api.post('/api/citas').set(hCliente).send({
      servicio_id: servicio.id, barbero_id: duenio.perfilId, fecha, hora_inicio: '10:00',
    }).expect(201);

    const agendaAjena = await api.get('/api/citas').set(h2).query({ barbero_id: duenio.perfilId, fecha });
    expect(agendaAjena.status).toBe(403);

    const listadoGlobal = await api.get('/api/citas').set(h2).query({ desde: fecha, hasta: fecha });
    expect(listadoGlobal.status).toBe(403);
    expect(barbero2.perfilId).not.toBe(duenio.perfilId);
  });
});

describe('defectos conocidos de la API (detectados al inventariar los endpoints)', () => {
  const INEXISTENTE_MAL_FORMADO = 'no-es-un-uuid';

  it.fails('[DEFECTO CONOCIDO H-05] un id de ruta que no es UUID responde 400 o 404, no 500', async () => {
    const respuestas = await Promise.all([
      api.get(`/api/servicios/${INEXISTENTE_MAL_FORMADO}`),
      api.get(`/api/barberos/${INEXISTENTE_MAL_FORMADO}`),
      api.get(`/api/clientes/${INEXISTENTE_MAL_FORMADO}`).set(hAdmin),
      api.put(`/api/citas/${INEXISTENTE_MAL_FORMADO}/cancelar`).set(hCliente),
    ]);
    expect(respuestas.map((r) => r.status).filter((s) => s >= 500)).toEqual([]);
  });

  it.fails('[DEFECTO CONOCIDO H-06] GET /api/citas con fechas o ids inválidos responde 400, no 500', async () => {
    const malas = await api.get('/api/citas').set(hAdmin).query({ desde: 'abc', hasta: 'def' });
    const maloId = await api.get('/api/citas').set(hAdmin).query({ barbero_id: 'x', fecha: fechaEn(3) });
    expect([malas.status, maloId.status]).toEqual([400, 400]);
  });

  it.fails('[DEFECTO CONOCIDO H-07] el catálogo público de barberos no expone correos ni identificadores de cuenta', async () => {
    const lista = (await api.get('/api/barberos')).body;
    const mio = lista.find((b) => b.id === duenio.perfilId);
    expect(mio).toBeTruthy();
    expect(mio).not.toHaveProperty('email');

    const detalle = (await api.get(`/api/barberos/${duenio.perfilId}`)).body;
    expect(detalle).not.toHaveProperty('email');
    expect(detalle).not.toHaveProperty('user_id');
  });

  it.fails('[DEFECTO CONOCIDO H-08] un barbero no puede marcar como atendida la cita de otro barbero', async () => {
    const cita = (await api.post('/api/citas').set(hCliente).send({
      servicio_id: servicio.id, barbero_id: duenio.perfilId, fecha: fechaEn(121), hora_inicio: '10:00',
    }).expect(201)).body;

    const res = await api.put(`/api/citas/${cita.id}/atender`).set(h2);
    expect(res.status).toBe(403);
  });

  it.fails('[DEFECTO CONOCIDO H-09] PUT /api/inventario/:id con cantidad_minima null quita el mínimo (desactiva la alerta)', async () => {
    const insumo = await crearInsumo({ disponible: 7, minimo: 2 });
    const res = await api.put(`/api/inventario/${insumo.id}`).set(hAdmin).send({ cantidad_minima: null });

    expect(res.status).toBe(200);
    expect(res.body.cantidad_minima).toBeNull();
  });
});
