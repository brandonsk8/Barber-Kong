// Quién puede ver o tocar qué: un barbero solo opera sobre lo suyo, la baja de un barbero
// cierra también su acceso y el catálogo público no filtra datos de cuenta.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { getApp, crearUsuario, crearServicio, login, fechaEn, cerrar } from '../helpers/fixtures.js';

let api, hAdmin, hCliente, hPropio, hOtro, barberoABaja, propio, otro, servicio;

beforeAll(async () => {
  api = request(await getApp());
  const [admin, cliente, baja, b1, b2] = await Promise.all(['admin', 'cliente', 'barbero', 'barbero', 'barbero'].map((role) => crearUsuario({ role })));
  barberoABaja = baja;
  propio = b1;
  otro = b2;
  [hAdmin, hCliente, hPropio, hOtro] = await Promise.all([admin, cliente, b1, b2].map(login));
  servicio = await crearServicio();
});
afterAll(cerrar);

const agendar = async (barbero, fecha) =>
  (await api.post('/api/citas').set(hCliente).send({ servicio_id: servicio.id, barbero_id: barbero.perfilId, fecha, hora_inicio: '10:00' }).expect(201)).body;

describe('baja de un barbero', () => {
  it('un barbero desactivado por el administrador ya no puede iniciar sesión', async () => {
    await api.delete(`/api/barberos/${barberoABaja.perfilId}`).set(hAdmin).expect(200);

    const res = await api.post('/api/auth/login').send({ email: barberoABaja.email, password: barberoABaja.password });
    expect(res.status).toBe(401);
  });
});

describe('agenda y citas de un barbero', () => {
  it('un barbero consulta su propia agenda, del día y por rango', async () => {
    const fecha = fechaEn(130);
    const cita = await agendar(propio, fecha);

    const dia = await api.get('/api/citas').set(hPropio).query({ barbero_id: propio.perfilId, fecha }).expect(200);
    expect(dia.body.map((c) => c.id)).toContain(cita.id);

    const rango = await api.get('/api/citas').set(hPropio).query({ barbero_id: propio.perfilId, desde: fecha, hasta: fecha }).expect(200);
    expect(rango.body.map((c) => c.id)).toContain(cita.id);
  });

  it('un barbero no puede consultar la agenda ni las citas de otro barbero', async () => {
    const fecha = fechaEn(131);
    await agendar(propio, fecha);

    const agendaAjena = await api.get('/api/citas').set(hOtro).query({ barbero_id: propio.perfilId, fecha });
    expect(agendaAjena.status).toBe(403);

    const rangoAjeno = await api.get('/api/citas').set(hOtro).query({ barbero_id: propio.perfilId, desde: fecha, hasta: fecha });
    expect(rangoAjeno.status).toBe(403);

    const listadoGlobal = await api.get('/api/citas').set(hOtro).query({ desde: fecha, hasta: fecha });
    expect(listadoGlobal.status).toBe(403);
  });

  it('el administrador sigue viendo la agenda de cualquier barbero y el listado global', async () => {
    const fecha = fechaEn(132);
    const cita = await agendar(propio, fecha);

    const agenda = await api.get('/api/citas').set(hAdmin).query({ barbero_id: propio.perfilId, fecha }).expect(200);
    expect(agenda.body.map((c) => c.id)).toContain(cita.id);

    const global = await api.get('/api/citas').set(hAdmin).query({ desde: fecha, hasta: fecha }).expect(200);
    expect(global.body.map((c) => c.id)).toContain(cita.id);
  });

  it('un barbero no puede marcar como atendida la cita de otro barbero', async () => {
    const cita = await agendar(propio, fechaEn(133));

    const res = await api.put(`/api/citas/${cita.id}/atender`).set(hOtro);
    expect(res.status).toBe(403);

    const sinCambios = await api.get('/api/citas').set(hAdmin).query({ barbero_id: propio.perfilId, fecha: fechaEn(133) }).expect(200);
    expect(sinCambios.body.find((c) => c.id === cita.id).estado).toBe('confirmada');
  });

  it('un barbero sí marca como atendida su propia cita', async () => {
    const cita = await agendar(propio, fechaEn(134));

    const res = await api.put(`/api/citas/${cita.id}/atender`).set(hPropio).expect(200);
    expect(res.body.estado).toBe('atendida');
  });
});

describe('catálogo público de barberos', () => {
  it('no expone correos ni identificadores de cuenta', async () => {
    const lista = (await api.get('/api/barberos').expect(200)).body;
    const mio = lista.find((b) => b.id === propio.perfilId);
    expect(mio).toBeTruthy();
    expect(mio).not.toHaveProperty('email');
    expect(mio).not.toHaveProperty('user_id');

    const detalle = (await api.get(`/api/barberos/${propio.perfilId}`).expect(200)).body;
    expect(detalle).not.toHaveProperty('email');
    expect(detalle).not.toHaveProperty('user_id');
    expect(detalle).toHaveProperty('horario');
  });

  it('el administrador sigue viendo el correo de cada barbero en su listado', async () => {
    const lista = (await api.get('/api/barberos/admin').set(hAdmin).expect(200)).body;
    expect(lista.find((b) => b.id === propio.perfilId).email).toBe(propio.email);
  });
});
