import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { query } from '../../src/config/db.js';
import {
  getApp, crearUsuario, crearServicio, crearInsumo, asociarInsumo, login, stockDe, fechaEn, unico, cerrar,
} from '../helpers/fixtures.js';

let api, hAdmin, hCliente, hBarbero, barbero, cliente;

beforeAll(async () => {
  api = request(await getApp());
  const [admin, c, b] = await Promise.all([crearUsuario({ role: 'admin' }), crearUsuario({ role: 'cliente' }), crearUsuario({ role: 'barbero' })]);
  barbero = b;
  cliente = c;
  [hAdmin, hCliente, hBarbero] = await Promise.all([admin, c, b].map(login));
});
afterAll(cerrar);

describe('inventario (API)', () => {
  it('crea un insumo en cero; el stock entra después con una entrada', async () => {
    const res = await api.post('/api/inventario').set(hAdmin).send({
      nombre: unico('insumo'), unidad_medida: 'ml', cantidad_minima: 300,
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ unidad_medida: 'ml' });
    expect(Number(res.body.cantidad_disponible)).toBe(0);
    expect(Number(res.body.cantidad_minima)).toBe(300);

    const conStock = await api.post(`/api/inventario/${res.body.id}/entrada`).set(hAdmin).send({ cantidad: 500 });
    expect(Number(conStock.body.cantidad_disponible)).toBe(500);
  });

  it('el stock no se puede fijar directamente al crear: solo entradas y consumos lo mueven', async () => {
    const res = await api.post('/api/inventario').set(hAdmin).send({
      nombre: unico('insumo'), unidad_medida: 'ml', cantidad_disponible: 50,
    });
    expect(res.status).toBe(400);
  });

  it('rechaza entradas en cero o negativas y mínimos negativos, sin tocar el stock', async () => {
    const insumo = await crearInsumo({ disponible: 5 });

    for (const mala of [0, -2]) {
      expect((await api.post(`/api/inventario/${insumo.id}/entrada`).set(hAdmin).send({ cantidad: mala })).status).toBe(400);
    }
    expect((await api.put(`/api/inventario/${insumo.id}`).set(hAdmin).send({ cantidad_minima: -1 })).status).toBe(400);
    expect(await stockDe(insumo.id)).toBe(5);
  });

  it('una entrada suma la cantidad (también decimales) y queda en el historial de movimientos', async () => {
    const insumo = await crearInsumo({ disponible: 5 });

    const res = await api.post(`/api/inventario/${insumo.id}/entrada`).set(hAdmin).send({ cantidad: 7.5 });
    expect(res.status).toBe(200);
    expect(Number(res.body.cantidad_disponible)).toBe(12.5);

    const { rows } = await query('SELECT tipo, cantidad FROM insumo_movimientos WHERE insumo_id = $1', [insumo.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].tipo).toBe('entrada');
    expect(Number(rows[0].cantidad)).toBe(7.5);
  });

  it('un insumo inexistente da 404', async () => {
    const res = await api.post('/api/inventario/11111111-1111-4111-8111-111111111111/entrada').set(hAdmin).send({ cantidad: 1 });
    expect(res.status).toBe(404);
  });
});

describe('insumos de un servicio (API)', () => {
  it('el administrador asocia un insumo con una cantidad positiva y no con cero ni negativa', async () => {
    const insumo = await crearInsumo();
    const svc = await crearServicio();
    const url = `/api/servicios/${svc.id}/insumos`;

    for (const mala of [0, -1]) {
      const res = await api.post(url).set(hAdmin).send({ insumo_id: insumo.id, cantidad_consumida: mala });
      expect(res.status, `cantidad ${mala}`).toBe(400);
    }
    const ok = await api.post(url).set(hAdmin).send({ insumo_id: insumo.id, cantidad_consumida: 30 });
    expect(ok.status).toBe(201);

    const lista = await api.get(url).set(hAdmin);
    expect(lista.body).toHaveLength(1);
    expect(Number(lista.body[0].cantidad_consumida)).toBe(30);
  });

  it('asociar otra vez el mismo insumo actualiza la cantidad en vez de duplicar la fila', async () => {
    const insumo = await crearInsumo();
    const svc = await crearServicio();
    const url = `/api/servicios/${svc.id}/insumos`;

    await api.post(url).set(hAdmin).send({ insumo_id: insumo.id, cantidad_consumida: 1 }).expect(201);
    await api.post(url).set(hAdmin).send({ insumo_id: insumo.id, cantidad_consumida: 2 }).expect(201);

    const lista = await api.get(url).set(hAdmin);
    expect(lista.body).toHaveLength(1);
    expect(Number(lista.body[0].cantidad_consumida)).toBe(2);
  });

  it('solo el administrador lo configura', async () => {
    const insumo = await crearInsumo();
    const svc = await crearServicio();
    const body = { insumo_id: insumo.id, cantidad_consumida: 1 };

    expect((await api.post(`/api/servicios/${svc.id}/insumos`).set(hCliente).send(body)).status).toBe(403);
    expect((await api.post(`/api/servicios/${svc.id}/insumos`).set(hBarbero).send(body)).status).toBe(403);
  });
});

describe('catálogo de servicios', () => {
  it('es público para leer; crear, editar y desactivar exige administrador', async () => {
    const svc = await crearServicio();

    expect((await api.get('/api/servicios')).status).toBe(200);
    expect((await api.get(`/api/servicios/${svc.id}`)).body.nombre).toBe(svc.nombre);
    expect((await api.put(`/api/servicios/${svc.id}`).set(hCliente).send({ precio: 1 })).status).toBe(403);
    expect((await api.delete(`/api/servicios/${svc.id}`)).status).toBe(401);
  });

  it('un servicio desactivado desaparece del catálogo público', async () => {
    const svc = await crearServicio();
    expect((await api.delete(`/api/servicios/${svc.id}`).set(hAdmin)).status).toBe(200);

    const { body } = await api.get('/api/servicios');
    expect(body.some((s) => s.id === svc.id)).toBe(false);
  });
});

describe('reportes descargables', () => {
  const rango = () => ({ desde: fechaEn(-1), hasta: fechaEn(60) });
  const descargar = (headers, tipo, formato, extra = {}) =>
    api.get('/api/reportes').set(headers).query({ tipo, formato, ...rango(), ...extra }).buffer(true).parse((res, cb) => {
      const trozos = [];
      res.on('data', (t) => trozos.push(t));
      res.on('end', () => cb(null, Buffer.concat(trozos)));
    });

  it('cada tipo se exporta en Excel y PDF con el tipo de contenido y el nombre de archivo correctos', async () => {
    for (const tipo of ['citas', 'ingresos', 'insumos']) {
      const xlsx = await descargar(hAdmin, tipo, 'excel');
      expect(xlsx.status, `${tipo} excel`).toBe(200);
      expect(xlsx.headers['content-type']).toContain('spreadsheetml');
      expect(xlsx.headers['content-disposition']).toMatch(new RegExp(`reporte-${tipo}-.*\\.xlsx`));
      expect(xlsx.body.subarray(0, 2).toString()).toBe('PK'); // un .xlsx es un zip

      const pdf = await descargar(hAdmin, tipo, 'pdf');
      expect(pdf.status, `${tipo} pdf`).toBe(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');
      expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    }
  });

  it('el reporte de citas refleja las citas reales del periodo y el de insumos, la cantidad consumida', async () => {
    const insumo = await crearInsumo({ disponible: 20 });
    const svc = await crearServicio({ precio: 75 });
    await asociarInsumo(svc.id, insumo.id, 3);
    const fecha = fechaEn(30);
    const cita = (await api.post('/api/citas/walkin').set(hBarbero).send({
      servicio_id: svc.id, barbero_id: barbero.perfilId, fecha, hora_inicio: '10:00', nombre_cliente: 'zz-test-reporte',
    })).body;
    await api.put(`/api/citas/${cita.id}/atender`).set(hBarbero).expect(200);

    const hoy = { desde: fechaEn(-1), hasta: fechaEn(1) }; // el consumo se agrupa por el día del movimiento (hoy)

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load((await descargar(hAdmin, 'citas', 'excel', { desde: fecha, hasta: fecha })).body);
    const celdas = [];
    libro.worksheets[0].eachRow((row) => celdas.push(...row.values.slice(1)));
    expect(celdas).toContain(svc.nombre);
    expect(celdas).toContain('Atendida');

    const insumos = new ExcelJS.Workbook();
    await insumos.xlsx.load((await descargar(hAdmin, 'insumos', 'excel', hoy)).body);
    let fila;
    insumos.worksheets[0].eachRow((row) => { if (row.getCell(1).value === insumo.nombre) fila = row.values.slice(1); });
    expect(fila).toEqual([insumo.nombre, 'frasco', 3]);

    const ingresos = new ExcelJS.Workbook();
    await ingresos.xlsx.load((await descargar(hAdmin, 'ingresos', 'excel', { desde: fecha, hasta: fecha })).body);
    let ingreso;
    ingresos.getWorksheet('Por servicio').eachRow((row) => { if (row.getCell(1).value === svc.nombre) ingreso = row.values.slice(1); });
    expect(ingreso).toEqual([svc.nombre, 1, 75]);
  });

  it('un periodo sin datos igual descarga el archivo', async () => {
    const res = await descargar(hAdmin, 'citas', 'pdf', { desde: '2001-01-01', hasta: '2001-01-02' });
    expect(res.status).toBe(200);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('valida los parámetros: rango invertido, tipo y formato desconocidos', async () => {
    const invertido = await api.get('/api/reportes').set(hAdmin).query({ tipo: 'citas', formato: 'pdf', desde: '2026-02-01', hasta: '2026-01-01' });
    expect(invertido.status).toBe(400);
    expect(invertido.body.message).toContain('no puede ser posterior');

    expect((await api.get('/api/reportes').set(hAdmin).query({ tipo: 'otro', formato: 'pdf', ...rango() })).status).toBe(400);
    expect((await api.get('/api/reportes').set(hAdmin).query({ tipo: 'citas', formato: 'word', ...rango() })).status).toBe(400);
  });
});
