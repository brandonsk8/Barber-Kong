import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import {
  getApp, crearUsuario, crearServicio, login, fechaEn, cerrar,
} from '../helpers/fixtures.js';

let api, cliente, otro, barbero, hCliente, hOtro, hBarbero;

beforeAll(async () => {
  api = request(await getApp());
  [cliente, otro, barbero] = await Promise.all([crearUsuario({ role: 'cliente' }), crearUsuario({ role: 'cliente' }), crearUsuario({ role: 'barbero' })]);
  [hCliente, hOtro, hBarbero] = await Promise.all([cliente, otro, barbero].map(login));
  const servicio = await crearServicio();
  await api.post('/api/citas').set(hCliente).send({
    servicio_id: servicio.id, barbero_id: barbero.perfilId, fecha: fechaEn(70), hora_inicio: '10:00',
  }).expect(201);
});
afterAll(cerrar);

describe('centro de notificaciones (UC-26)', () => {
  it('exige sesión', async () => {
    expect((await api.get('/api/notificaciones')).status).toBe(401);
    expect((await api.put('/api/notificaciones/11111111-1111-4111-8111-111111111111/leer')).status).toBe(401);
  });

  it('agendar deja una notificación sin leer para el cliente y otra para el barbero', async () => {
    const mias = (await api.get('/api/notificaciones').set(hCliente)).body;
    expect(mias).toHaveLength(1);
    expect(mias[0]).toMatchObject({ tipo: 'confirmacion_cita', leida: false, user_id: cliente.id });
    expect(mias[0].titulo).toContain('Cita confirmada');

    const delBarbero = (await api.get('/api/notificaciones').set(hBarbero)).body;
    expect(delBarbero).toHaveLength(1);
    expect(delBarbero[0].titulo).toContain('Nueva cita agendada');
  });

  it('cada usuario solo ve las suyas', async () => {
    expect((await api.get('/api/notificaciones').set(hOtro)).body).toEqual([]);
  });

  it('marcar como leída cambia el estado y no afecta a las demás', async () => {
    const [n] = (await api.get('/api/notificaciones').set(hCliente)).body;

    const res = await api.put(`/api/notificaciones/${n.id}/leer`).set(hCliente);
    expect(res.status).toBe(200);
    expect(res.body.leida).toBe(true);

    expect((await api.get('/api/notificaciones').set(hCliente)).body[0].leida).toBe(true);
    expect((await api.get('/api/notificaciones').set(hBarbero)).body[0].leida).toBe(false);
  });

  it('no se puede marcar una notificación ajena (403) ni una inexistente (404)', async () => {
    const [n] = (await api.get('/api/notificaciones').set(hBarbero)).body;

    expect((await api.put(`/api/notificaciones/${n.id}/leer`).set(hOtro)).status).toBe(403);
    expect((await api.get('/api/notificaciones').set(hBarbero)).body[0].leida).toBe(false);
    expect((await api.put('/api/notificaciones/11111111-1111-4111-8111-111111111111/leer').set(hOtro)).status).toBe(404);
  });
});
