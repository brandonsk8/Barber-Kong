// Defectos de control de acceso detectados por las pruebas y aún sin corregir. Cada caso
// describe el comportamiento CORRECTO esperado y usa `it.fails`: mientras el defecto
// exista la prueba "pasa" (falla como se espera) y el CI sigue en verde; cuando se
// corrija, la prueba empezará a fallar con "Expect test to fail" y habrá que cambiar
// `it.fails` por `it`. Se documentan en el Plan de Pruebas como H-03 y H-04.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { getApp, crearUsuario, crearServicio, login, fechaEn, cerrar } from '../helpers/fixtures.js';

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
