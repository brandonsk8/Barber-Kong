// Entradas mal formadas: un id de ruta que no es UUID o una consulta con fechas inválidas
// se rechazan con 400 (nunca 500), y la edición parcial de un insumo distingue entre
// "no cambiar el mínimo" y "quitarlo".
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { getApp, crearUsuario, crearInsumo, login, fechaEn, cerrar } from '../helpers/fixtures.js';

let api, hAdmin, hCliente, barbero;
const MAL_ID = 'no-es-un-uuid';
const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

beforeAll(async () => {
  api = request(await getApp());
  const [admin, cliente, b] = await Promise.all(['admin', 'cliente', 'barbero'].map((role) => crearUsuario({ role })));
  barbero = b;
  [hAdmin, hCliente] = await Promise.all([admin, cliente].map(login));
});
afterAll(cerrar);

describe('ids de ruta', () => {
  it('un id que no es UUID responde 400 con mensaje en español, en todos los módulos', async () => {
    const llamadas = [
      () => api.get(`/api/servicios/${MAL_ID}`),
      () => api.put(`/api/servicios/${MAL_ID}`).set(hAdmin).send({ nombre: 'x' }),
      () => api.get(`/api/servicios/${MAL_ID}/insumos`).set(hAdmin),
      () => api.delete(`/api/servicios/${UUID_INEXISTENTE}/insumos/${MAL_ID}`).set(hAdmin),
      () => api.get(`/api/barberos/${MAL_ID}`),
      () => api.get(`/api/barberos/${MAL_ID}/horario`),
      () => api.delete(`/api/barberos/${barbero.perfilId}/ausencias/${MAL_ID}`).set(hAdmin),
      () => api.get(`/api/clientes/${MAL_ID}`).set(hAdmin),
      () => api.get(`/api/clientes/${MAL_ID}/historial`).set(hAdmin),
      () => api.put(`/api/citas/${MAL_ID}/cancelar`).set(hCliente),
      () => api.put(`/api/citas/${MAL_ID}/atender`).set(hAdmin),
      () => api.put(`/api/citas/${MAL_ID}`).set(hCliente).send({ fecha: fechaEn(5), hora_inicio: '10:00' }),
      () => api.put(`/api/inventario/${MAL_ID}`).set(hAdmin).send({ nombre: 'x' }),
      () => api.post(`/api/inventario/${MAL_ID}/entrada`).set(hAdmin).send({ cantidad: 1 }),
      () => api.put(`/api/notificaciones/${MAL_ID}/leer`).set(hCliente),
    ];
    const respuestas = [];
    for (const llamar of llamadas) respuestas.push(await llamar()); // en serie: evita abrir decenas de servidores a la vez

    expect(respuestas.map((r) => r.status)).toEqual(Array(respuestas.length).fill(400));
    expect(respuestas[0].body.message).toBe('El identificador no es válido.');
  });

  it('un UUID válido que no existe sigue dando 404', async () => {
    const respuestas = await Promise.all([
      api.get(`/api/servicios/${UUID_INEXISTENTE}`),
      api.get(`/api/barberos/${UUID_INEXISTENTE}`),
      api.get(`/api/clientes/${UUID_INEXISTENTE}`).set(hAdmin),
    ]);
    expect(respuestas.map((r) => r.status)).toEqual([404, 404, 404]);
  });

  it('las rutas fijas que comparten prefijo con :id no se confunden con un id', async () => {
    await api.get('/api/barberos/admin').set(hAdmin).expect(200);
    await api.get('/api/citas/mias').set(hCliente).expect(200);
  });
});

describe('consulta de GET /api/citas', () => {
  it('fechas o ids inválidos responden 400 con mensaje en español', async () => {
    const rangoMalo = await api.get('/api/citas').set(hAdmin).query({ desde: 'abc', hasta: 'def' });
    const idMalo = await api.get('/api/citas').set(hAdmin).query({ barbero_id: 'x', fecha: fechaEn(3) });
    const fechaMala = await api.get('/api/citas').set(hAdmin).query({ barbero_id: barbero.perfilId, fecha: '2026-13-45' });

    expect([rangoMalo.status, idMalo.status, fechaMala.status]).toEqual([400, 400, 400]);
    expect(rangoMalo.body.message).toContain('AAAA-MM-DD');
    expect(idMalo.body.message).toContain('identificador');
  });

  it('una consulta válida sigue funcionando y sin parámetros pide cuáles usar', async () => {
    await api.get('/api/citas').set(hAdmin).query({ barbero_id: barbero.perfilId, fecha: fechaEn(3) }).expect(200);
    await api.get('/api/citas').set(hAdmin).query({ desde: fechaEn(3), hasta: fechaEn(4) }).expect(200);
    await api.get('/api/citas').set(hAdmin).expect(400);
  });
});

describe('edición parcial de un insumo', () => {
  it('cantidad_minima null quita el mínimo; omitirla lo conserva; un número lo cambia', async () => {
    const insumo = await crearInsumo({ disponible: 7, minimo: 2 });

    const soloNombre = await api.put(`/api/inventario/${insumo.id}`).set(hAdmin).send({ nombre: 'zz-test renombrado' }).expect(200);
    expect(Number(soloNombre.body.cantidad_minima)).toBe(2);

    const nuevoMinimo = await api.put(`/api/inventario/${insumo.id}`).set(hAdmin).send({ cantidad_minima: 5 }).expect(200);
    expect(Number(nuevoMinimo.body.cantidad_minima)).toBe(5);

    const sinMinimo = await api.put(`/api/inventario/${insumo.id}`).set(hAdmin).send({ cantidad_minima: null }).expect(200);
    expect(sinMinimo.body.cantidad_minima).toBeNull();
    expect(sinMinimo.body.nombre).toBe('zz-test renombrado');
  });
});
