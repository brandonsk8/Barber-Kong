// Defectos detectados por las pruebas y aún sin corregir. Cada caso describe el
// comportamiento CORRECTO esperado y usa `it.fails`: mientras el defecto exista la prueba
// "pasa" (falla como se espera) y el CI sigue en verde; cuando se corrija, la prueba
// empezará a fallar con "Expect test to fail" y habrá que cambiar `it.fails` por `it`.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { getApp, crearUsuario, crearInsumo, login, fechaEn, cerrar } from '../helpers/fixtures.js';

let api, hAdmin, hCliente;

beforeAll(async () => {
  api = request(await getApp());
  const [admin, cliente] = await Promise.all(['admin', 'cliente'].map((role) => crearUsuario({ role })));
  [hAdmin, hCliente] = await Promise.all([admin, cliente].map(login));
});
afterAll(cerrar);

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

  it.fails('[DEFECTO CONOCIDO H-09] PUT /api/inventario/:id con cantidad_minima null quita el mínimo (desactiva la alerta)', async () => {
    const insumo = await crearInsumo({ disponible: 7, minimo: 2 });
    const res = await api.put(`/api/inventario/${insumo.id}`).set(hAdmin).send({ cantidad_minima: null });

    expect(res.status).toBe(200);
    expect(res.body.cantidad_minima).toBeNull();
  });
});
