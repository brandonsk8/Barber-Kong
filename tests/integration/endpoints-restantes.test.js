// Endpoints que ninguna otra prueba ejercitaba por HTTP (o solo por el camino de error):
// PUT /auth/2fa, ausencias (listar y quitar), quitar insumo de un servicio, listar y editar
// insumos, detalle de barbero y /health.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import {
  getApp, crearUsuario, crearServicio, crearInsumo, asociarInsumo, login, fechaEn, unico, cerrar,
} from '../helpers/fixtures.js';

const INEXISTENTE = '11111111-1111-4111-8111-111111111111';
let api, admin, hAdmin, barbero, hBarbero, otroBarbero, hOtroBarbero, cliente, hCliente;

beforeAll(async () => {
  api = request(await getApp());
  [admin, barbero, otroBarbero, cliente] = await Promise.all(['admin', 'barbero', 'barbero', 'cliente'].map((role) => crearUsuario({ role })));
  [hAdmin, hBarbero, hOtroBarbero, hCliente] = await Promise.all([admin, barbero, otroBarbero, cliente].map(login));
});
afterAll(cerrar);

describe('GET /api/health', () => {
  it('responde 200 con el estado del servicio, sin sesión', async () => {
    const res = await api.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('PUT /api/auth/2fa (RF-AUT-07)', () => {
  it('activar el 2FA exige sesión, el campo `enabled` y la contraseña actual', async () => {
    const u = await crearUsuario({ role: 'cliente' });
    const h = await login(u);

    expect((await api.put('/api/auth/2fa').send({ enabled: true, password: u.password })).status).toBe(401);
    expect((await api.put('/api/auth/2fa').set(h).send({ enabled: true })).status).toBe(400);
    expect((await api.put('/api/auth/2fa').set(h).send({ enabled: true, password: 'incorrecta' })).status).toBe(401);
  });

  it('con la contraseña correcta activa el 2FA y el siguiente inicio de sesión pide código; se puede desactivar', async () => {
    const u = await crearUsuario({ role: 'cliente' });
    const h = await login(u);

    const on = await api.put('/api/auth/2fa').set(h).send({ enabled: true, password: u.password });
    expect(on.status).toBe(200);
    expect(on.body.user.twoFactorEnabled).toBe(true);

    const entrar = await api.post('/api/auth/login').send({ email: u.email, password: u.password });
    expect(entrar.body).toMatchObject({ requiresTwoFactor: true });
    expect(entrar.body.token).toBeUndefined();

    const off = await api.put('/api/auth/2fa').set(h).send({ enabled: false, password: u.password });
    expect(off.body.user.twoFactorEnabled).toBe(false);
    expect((await api.post('/api/auth/login').send({ email: u.email, password: u.password })).body.token).toBeTruthy();
  });
});

describe('GET /api/barberos/:id (detalle público)', () => {
  it('devuelve el barbero con su horario semanal', async () => {
    const res = await api.get(`/api/barberos/${barbero.perfilId}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: barbero.perfilId, nombre: barbero.nombre, is_active: true });
    expect(Array.isArray(res.body.horario)).toBe(true);
    expect(res.body.horario.length).toBeGreaterThan(0);
    expect(res.body.horario[0]).toHaveProperty('dia_semana');
  });
});

describe('ausencias: listar y quitar (agenda del barbero)', () => {
  const crear = (headers, fecha, motivo = 'Trámite') => api.post(`/api/barberos/${barbero.perfilId}/ausencias`).set(headers).send({ fecha, motivo });

  it('el barbero lista sus ausencias y el administrador también; otro barbero recibe 403', async () => {
    const fecha = fechaEn(140);
    await crear(hBarbero, fecha).expect(201);

    const propia = await api.get(`/api/barberos/${barbero.perfilId}/ausencias`).set(hBarbero);
    expect(propia.status).toBe(200);
    expect(propia.body.some((a) => a.fecha === fecha && a.motivo === 'Trámite')).toBe(true);

    expect((await api.get(`/api/barberos/${barbero.perfilId}/ausencias`).set(hAdmin)).status).toBe(200);
    expect((await api.get(`/api/barberos/${barbero.perfilId}/ausencias`).set(hOtroBarbero)).status).toBe(403);
    expect((await api.get(`/api/barberos/${barbero.perfilId}/ausencias`).set(hCliente)).status).toBe(403);
    expect((await api.get(`/api/barberos/${barbero.perfilId}/ausencias`)).status).toBe(401);
  });

  it('quitar una ausencia responde 204, vuelve a habilitar el día y repetirlo da 404', async () => {
    const fecha = fechaEn(141);
    const { body: a } = await crear(hBarbero, fecha).expect(201);

    expect((await api.delete(`/api/barberos/${barbero.perfilId}/ausencias/${a.id}`).set(hOtroBarbero)).status).toBe(403);
    expect((await api.delete(`/api/barberos/${barbero.perfilId}/ausencias/${a.id}`).set(hBarbero)).status).toBe(204);

    const disp = await api.get(`/api/barberos/${barbero.perfilId}/disponibilidad`).query({ fecha });
    expect(disp.body.ausente).toBe(false);
    expect((await api.delete(`/api/barberos/${barbero.perfilId}/ausencias/${a.id}`).set(hBarbero)).status).toBe(404);
  });
});

describe('inventario: listar y editar insumos (RF-INV-01)', () => {
  it('el administrador lista los insumos y encuentra el que acaba de crear', async () => {
    const insumo = await crearInsumo({ disponible: 7, minimo: 2 });
    const res = await api.get('/api/inventario').set(hAdmin);

    expect(res.status).toBe(200);
    const fila = res.body.find((i) => i.id === insumo.id);
    expect(fila).toMatchObject({ nombre: insumo.nombre, unidad_medida: 'frasco' });
    expect(Number(fila.cantidad_disponible)).toBe(7);
    expect(Number(fila.cantidad_minima)).toBe(2);
  });

  it('editar cambia solo lo enviado y un insumo inexistente da 404', async () => {
    const insumo = await crearInsumo({ disponible: 7, minimo: 2 });

    const res = await api.put(`/api/inventario/${insumo.id}`).set(hAdmin).send({ nombre: unico('renombrado'), cantidad_minima: 5 });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toContain('renombrado');
    expect(Number(res.body.cantidad_minima)).toBe(5);
    expect(Number(res.body.cantidad_disponible)).toBe(7);
    expect(res.body.unidad_medida).toBe('frasco');

    expect((await api.put(`/api/inventario/${INEXISTENTE}`).set(hAdmin).send({ nombre: 'x' })).status).toBe(404);
  });
});

describe('DELETE /api/servicios/:id/insumos/:insumoId (RF-SER-02)', () => {
  it('quita el insumo del servicio (204), no toca el insumo y repetirlo da 404; solo el administrador', async () => {
    const insumo = await crearInsumo();
    const svc = await crearServicio();
    await asociarInsumo(svc.id, insumo.id, 2);
    const url = `/api/servicios/${svc.id}/insumos/${insumo.id}`;

    expect((await api.delete(url).set(hCliente)).status).toBe(403);
    expect((await api.delete(url).set(hAdmin)).status).toBe(204);

    expect((await api.get(`/api/servicios/${svc.id}/insumos`).set(hAdmin)).body).toEqual([]);
    expect((await api.get('/api/inventario').set(hAdmin)).body.some((i) => i.id === insumo.id)).toBe(true);
    expect((await api.delete(url).set(hAdmin)).status).toBe(404);
  });
});
