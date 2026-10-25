import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import {
  getApp, crearUsuario, crearServicio, login, fechaEn, unico, cerrar,
} from '../helpers/fixtures.js';

let api, hAdmin, hCliente, hBarbero, cliente, barbero, servicio;

const crear = (datos = {}) => api.post('/api/clientes').set(hAdmin).send({ nombre: unico('cliente'), ...datos });

beforeAll(async () => {
  api = request(await getApp());
  const [admin, c, b] = await Promise.all([crearUsuario({ role: 'admin' }), crearUsuario({ role: 'cliente' }), crearUsuario({ role: 'barbero' })]);
  cliente = c;
  barbero = b;
  servicio = await crearServicio({ duracion: 30 });
  [hAdmin, hCliente, hBarbero] = await Promise.all([admin, c, b].map(login));
});
afterAll(cerrar);

describe('permisos del módulo de clientes', () => {
  it('solo el administrador entra: cliente y barbero reciben 403, sin sesión 401', async () => {
    expect((await api.get('/api/clientes').set(hCliente)).status).toBe(403);
    expect((await api.get('/api/clientes').set(hBarbero)).status).toBe(403);
    expect((await api.post('/api/clientes').set(hCliente).send({ nombre: 'x' })).status).toBe(403);
    expect((await api.get('/api/clientes')).status).toBe(401);
  });
});

describe('registrar y editar clientes (UC-08, UC-11)', () => {
  it('el administrador registra un cliente sin cuenta con nombre, teléfono y correo opcionales', async () => {
    const nombre = unico('cliente');
    const res = await api.post('/api/clientes').set(hAdmin).send({ nombre, telefono: '5555-1234', correo: 'c@test.local' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nombre, telefono: '5555-1234', correo: 'c@test.local', is_active: true, user_id: null });

    const minimo = await crear();
    expect(minimo.status).toBe(201);
    expect(minimo.body.telefono).toBeNull();
  });

  it('valida los datos: nombre obligatorio, correo con formato y campos desconocidos', async () => {
    expect((await api.post('/api/clientes').set(hAdmin).send({ telefono: '1' })).status).toBe(400);
    expect((await crear({ correo: 'no-es-correo' })).status).toBe(400);
    expect((await crear({ extra: 'x' })).status).toBe(400);
  });

  it('editar cambia solo los campos enviados y conserva el resto', async () => {
    const { body: c } = await crear({ telefono: '1111', correo: 'a@test.local' });

    const res = await api.put(`/api/clientes/${c.id}`).set(hAdmin).send({ telefono: '2222' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nombre: c.nombre, telefono: '2222', correo: 'a@test.local' });

    expect((await api.put(`/api/clientes/${c.id}`).set(hAdmin).send({ correo: 'mal' })).status).toBe(400);
  });

  it('un cliente inexistente da 404 al consultar, editar, activar o desactivar', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect((await api.get(`/api/clientes/${id}`).set(hAdmin)).status).toBe(404);
    expect((await api.put(`/api/clientes/${id}`).set(hAdmin).send({ nombre: 'x' })).status).toBe(404);
    expect((await api.put(`/api/clientes/${id}/activar`).set(hAdmin)).status).toBe(404);
    expect((await api.delete(`/api/clientes/${id}`).set(hAdmin)).status).toBe(404);
  });
});

describe('buscar y filtrar clientes (UC-09)', () => {
  it('busca por nombre o por teléfono sin distinguir mayúsculas', async () => {
    const marca = unico('buscable');
    const { body: a } = await crear({ nombre: `${marca}-Rosa`, telefono: '7000-0001' });
    await crear({ nombre: `${marca}-Otro`, telefono: '7000-0002' });

    const porNombre = await api.get('/api/clientes').set(hAdmin).query({ search: `${marca.toUpperCase()}-rosa` });
    expect(porNombre.body.map((c) => c.id)).toEqual([a.id]);

    const porTelefono = await api.get('/api/clientes').set(hAdmin).query({ search: '7000-0002' });
    expect(porTelefono.body.every((c) => c.telefono === '7000-0002')).toBe(true);
    expect(porTelefono.body.length).toBeGreaterThanOrEqual(1);

    expect((await api.get('/api/clientes').set(hAdmin).query({ search: `${marca}-no-existe` })).body).toEqual([]);
  });

  it('por defecto lista solo activos; "inactivos" y "todos" permiten encontrar a los desactivados', async () => {
    const { body: c } = await crear({ nombre: unico('desactivable') });
    const ids = async (estado) => (await api.get('/api/clientes').set(hAdmin).query({ search: c.nombre, ...(estado ? { estado } : {}) })).body.map((x) => x.id);

    expect(await ids()).toEqual([c.id]);
    await api.delete(`/api/clientes/${c.id}`).set(hAdmin).expect(200);

    expect(await ids()).toEqual([]);
    expect(await ids('inactivos')).toEqual([c.id]);
    expect(await ids('todos')).toEqual([c.id]);
  });

  it('desactivar y volver a activar cambia el estado y conserva los datos', async () => {
    const { body: c } = await crear({ telefono: '9999' });

    const off = await api.delete(`/api/clientes/${c.id}`).set(hAdmin);
    expect(off.body.is_active).toBe(false);

    const on = await api.put(`/api/clientes/${c.id}/activar`).set(hAdmin);
    expect(on.body).toMatchObject({ is_active: true, nombre: c.nombre, telefono: '9999' });
  });
});

describe('historial del cliente (UC-10)', () => {
  it('muestra las citas del cliente con servicio, barbero y estado, la más reciente primero', async () => {
    const [f1, f2] = [fechaEn(60), fechaEn(61)];
    const agendar = (fecha) => api.post('/api/citas').set(hCliente).send({
      servicio_id: servicio.id, barbero_id: barbero.perfilId, fecha, hora_inicio: '10:00',
    });
    await agendar(f1).expect(201);
    const segunda = (await agendar(f2).expect(201)).body;
    await api.put(`/api/citas/${segunda.id}/cancelar`).set(hCliente).expect(200);

    const historial = await api.get(`/api/clientes/${cliente.perfilId}/historial`).set(hAdmin);
    expect(historial.status).toBe(200);
    expect(historial.body.map((h) => [h.fecha, h.estado])).toEqual([[f2, 'cancelada'], [f1, 'confirmada']]);
    expect(historial.body[0]).toMatchObject({ servicio: servicio.nombre, barbero: barbero.nombre });

    const ficha = await api.get(`/api/clientes/${cliente.perfilId}`).set(hAdmin);
    expect(Number(ficha.body.citas_totales)).toBe(2);
    expect(ficha.body.ultima_visita).toBe(f2);
  });

  it('un cliente sin citas tiene historial vacío y uno inexistente da 404', async () => {
    const { body: c } = await crear();
    expect((await api.get(`/api/clientes/${c.id}/historial`).set(hAdmin)).body).toEqual([]);
    expect((await api.get('/api/clientes/11111111-1111-4111-8111-111111111111/historial').set(hAdmin)).status).toBe(404);
  });
});
