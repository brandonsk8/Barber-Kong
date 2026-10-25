import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { sendMail } from '../../src/services/mailer.js';
import { query } from '../../src/config/db.js';
import {
  getApp, crearUsuario, crearServicio, crearInsumo, asociarInsumo, login, stockDe, fechaEn, cerrar,
} from '../helpers/fixtures.js';

let api, cliente, otroCliente, barbero, otroBarbero, admin, servicio;
let hCliente, hOtro, hBarbero, hOtroBarbero, hAdmin;
let dia = 20; // cada prueba usa una fecha distinta para no chocar entre sí

const nuevaFecha = () => fechaEn(dia++);
const agendar = (headers, extra = {}) =>
  api.post('/api/citas').set(headers).send({
    servicio_id: servicio.id,
    barbero_id: barbero.perfilId,
    fecha: nuevaFecha(),
    hora_inicio: '10:00',
    ...extra,
  });

beforeAll(async () => {
  api = request(await getApp());
  [cliente, otroCliente, barbero, otroBarbero, admin] = await Promise.all([
    crearUsuario({ role: 'cliente' }), crearUsuario({ role: 'cliente' }),
    crearUsuario({ role: 'barbero' }), crearUsuario({ role: 'barbero' }),
    crearUsuario({ role: 'admin' }),
  ]);
  servicio = await crearServicio({ duracion: 60 });
  [hCliente, hOtro, hBarbero, hOtroBarbero, hAdmin] = await Promise.all(
    [cliente, otroCliente, barbero, otroBarbero, admin].map(login)
  );
});
afterAll(cerrar);
beforeEach(() => vi.mocked(sendMail).mockClear());

describe('agendar una cita', () => {
  it('crea la cita confirmada, calcula la hora de fin y avisa por correo al cliente y al barbero', async () => {
    const res = await agendar(hCliente);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ estado: 'confirmada', hora_inicio: '10:00:00', hora_fin: '11:00:00', es_walkin: false });

    const destinatarios = vi.mocked(sendMail).mock.calls.map(([m]) => m.to);
    expect(destinatarios).toEqual(expect.arrayContaining([cliente.email, barbero.email]));
    const avisoBarbero = vi.mocked(sendMail).mock.calls.find(([m]) => m.to === barbero.email)[0];
    expect(avisoBarbero.subject).toContain('Nueva cita agendada');

    const { rows } = await query('SELECT tipo FROM notificaciones WHERE user_id = ANY($1)', [[cliente.id, barbero.id]]);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it('el mismo horario ya no se puede reservar (409), pero uno que no se traslapa sí', async () => {
    const fecha = nuevaFecha();
    expect((await agendar(hCliente, { fecha, hora_inicio: '09:00' })).status).toBe(201); // 09:00-10:00

    const choca = await agendar(hOtro, { fecha, hora_inicio: '09:30' });
    expect(choca.status).toBe(409);
    expect(choca.body.message).toContain('ya no está disponible');

    expect((await agendar(hOtro, { fecha, hora_inicio: '10:00' })).status).toBe(201); // justo después
  });

  it('otro barbero sí está libre a la misma hora', async () => {
    const fecha = nuevaFecha();
    await agendar(hCliente, { fecha });
    const res = await agendar(hOtro, { fecha, barbero_id: otroBarbero.perfilId });
    expect(res.status).toBe(201);
  });

  it('rechaza fechas pasadas, horas fuera de horario y el receso del almuerzo', async () => {
    const pasada = await agendar(hCliente, { fecha: fechaEn(-3) });
    expect(pasada.status).toBe(400);
    expect(pasada.body.message).toContain('fecha pasada');

    expect((await agendar(hCliente, { hora_inicio: '07:00' })).status).toBe(409);
    expect((await agendar(hCliente, { hora_inicio: '12:30' })).status).toBe(409); // 12:30-13:30 cruza el receso
  });

  it('valida el cuerpo: formato de hora, uuid y campos de más', async () => {
    expect((await agendar(hCliente, { hora_inicio: '10am' })).status).toBe(400);
    expect((await agendar(hCliente, { servicio_id: 'no-uuid' })).status).toBe(400);
    expect((await agendar(hCliente, { extra: 'x' })).status).toBe(400);
  });

  it('servicio o barbero inexistentes dan 404', async () => {
    const inexistente = '11111111-1111-4111-8111-111111111111';
    expect((await agendar(hCliente, { servicio_id: inexistente })).status).toBe(404);
    expect((await agendar(hCliente, { barbero_id: inexistente })).status).toBe(404);
  });

  it('solo el cliente agenda: barbero y administrador no pueden usar este endpoint', async () => {
    expect((await agendar(hBarbero)).status).toBe(403);
    expect((await agendar(hAdmin)).status).toBe(403);
  });
});

describe('ausencias del barbero', () => {
  it('un día marcado como ausente no se puede reservar y la disponibilidad lo refleja', async () => {
    const fecha = nuevaFecha();
    const ausencia = await api.post(`/api/barberos/${barbero.perfilId}/ausencias`).set(hBarbero).send({ fecha, motivo: 'Trámite' });
    expect(ausencia.status).toBe(201);

    const res = await agendar(hCliente, { fecha });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('no estará disponible');

    const disp = await api.get(`/api/barberos/${barbero.perfilId}/disponibilidad`).query({ fecha });
    expect(disp.body).toMatchObject({ ausente: true, trabaja: false, bloques: [] });
  });

  it('un barbero no puede gestionar la agenda de otro, pero el administrador sí', async () => {
    const fecha = nuevaFecha();
    const ajena = await api.post(`/api/barberos/${barbero.perfilId}/ausencias`).set(hOtroBarbero).send({ fecha });
    expect(ajena.status).toBe(403);

    expect((await api.post(`/api/barberos/${barbero.perfilId}/ausencias`).set(hAdmin).send({ fecha })).status).toBe(201);
  });

  it('no deja marcar dos veces el mismo día (409)', async () => {
    const fecha = nuevaFecha();
    await api.post(`/api/barberos/${barbero.perfilId}/ausencias`).set(hBarbero).send({ fecha });
    expect((await api.post(`/api/barberos/${barbero.perfilId}/ausencias`).set(hBarbero).send({ fecha })).status).toBe(409);
  });
});

describe('cancelar y reprogramar: solo quien es dueño de la cita', () => {
  it('otro cliente no puede cancelar ni reprogramar una cita ajena (403)', async () => {
    const cita = (await agendar(hCliente)).body;

    expect((await api.put(`/api/citas/${cita.id}/cancelar`).set(hOtro)).status).toBe(403);
    expect((await api.put(`/api/citas/${cita.id}`).set(hOtro).send({ fecha: nuevaFecha(), hora_inicio: '15:00' })).status).toBe(403);
    expect((await query('SELECT estado FROM citas WHERE id = $1', [cita.id])).rows[0].estado).toBe('confirmada');
  });

  it('el dueño reprograma a otra hora libre y la cita conserva su estado', async () => {
    const cita = (await agendar(hCliente)).body;
    const fecha = nuevaFecha();
    const res = await api.put(`/api/citas/${cita.id}`).set(hCliente).send({ fecha, hora_inicio: '15:00' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ fecha, hora_inicio: '15:00:00', hora_fin: '16:00:00' });
  });

  it('cancelar libera el horario para otro cliente y es idempotente', async () => {
    const fecha = nuevaFecha();
    const cita = (await agendar(hCliente, { fecha })).body;

    const c1 = await api.put(`/api/citas/${cita.id}/cancelar`).set(hCliente);
    expect(c1.status).toBe(200);
    expect(c1.body.estado).toBe('cancelada');
    expect((await api.put(`/api/citas/${cita.id}/cancelar`).set(hCliente)).status).toBe(200);

    expect((await agendar(hOtro, { fecha })).status).toBe(201);
  });

  it('"mis citas" solo trae las del cliente que consulta', async () => {
    const { body: mias } = await api.get('/api/citas/mias').set(hCliente);
    const { body: suyas } = await api.get('/api/citas/mias').set(hOtro);

    const idsMias = new Set(mias.map((c) => c.id));
    expect(suyas.every((c) => !idsMias.has(c.id))).toBe(true);
  });
});

describe('marcar atendida: descuento de insumos (UC-16/UC-17)', () => {
  it('descuenta la cantidad configurada, deja el movimiento ligado a la cita y no vuelve a descontar', async () => {
    const insumo = await crearInsumo({ disponible: 10, minimo: 2 });
    const svc = await crearServicio({ duracion: 30 });
    await asociarInsumo(svc.id, insumo.id, 2);
    const cita = (await agendar(hCliente, { servicio_id: svc.id })).body;

    const res = await api.put(`/api/citas/${cita.id}/atender`).set(hBarbero);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('atendida');
    expect(await stockDe(insumo.id)).toBe(8);

    const { rows } = await query('SELECT tipo, cantidad, cita_id FROM insumo_movimientos WHERE insumo_id = $1', [insumo.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tipo: 'salida', cita_id: cita.id });
    expect(Number(rows[0].cantidad)).toBe(2);

    // Marcarla otra vez no descuenta de nuevo.
    expect((await api.put(`/api/citas/${cita.id}/atender`).set(hBarbero)).status).toBe(200);
    expect(await stockDe(insumo.id)).toBe(8);
  });

  it('también descuenta cantidades en ml o decimales: 30 ml de un stock de 500 dejan 470', async () => {
    const insumo = await crearInsumo({ disponible: 500, minimo: 100 });
    const svc = await crearServicio();
    await asociarInsumo(svc.id, insumo.id, 30);
    const cita = (await agendar(hCliente, { servicio_id: svc.id })).body;

    await api.put(`/api/citas/${cita.id}/atender`).set(hBarbero).expect(200);
    expect(await stockDe(insumo.id)).toBe(470);

    const otro = await crearInsumo({ disponible: 2, minimo: 0 });
    const svc2 = await crearServicio();
    await asociarInsumo(svc2.id, otro.id, 0.25);
    const cita2 = (await agendar(hCliente, { servicio_id: svc2.id })).body;
    await api.put(`/api/citas/${cita2.id}/atender`).set(hBarbero).expect(200);
    expect(await stockDe(otro.id)).toBe(1.75);
  });

  it('un servicio con varios insumos los descuenta todos', async () => {
    const [a, b] = await Promise.all([crearInsumo({ disponible: 9 }), crearInsumo({ disponible: 5 })]);
    const svc = await crearServicio();
    await asociarInsumo(svc.id, a.id, 3);
    await asociarInsumo(svc.id, b.id, 1);
    const cita = (await agendar(hCliente, { servicio_id: svc.id })).body;

    await api.put(`/api/citas/${cita.id}/atender`).set(hAdmin).expect(200);

    expect([await stockDe(a.id), await stockDe(b.id)]).toEqual([6, 4]);
  });

  it('si el stock queda por debajo del mínimo, avisa por correo a los administradores (después de confirmar)', async () => {
    const insumo = await crearInsumo({ disponible: 3, minimo: 3 });
    const svc = await crearServicio();
    await asociarInsumo(svc.id, insumo.id, 1);
    const cita = (await agendar(hCliente, { servicio_id: svc.id })).body;
    vi.mocked(sendMail).mockClear();

    await api.put(`/api/citas/${cita.id}/atender`).set(hBarbero).expect(200);

    const alerta = vi.mocked(sendMail).mock.calls.map(([m]) => m).find((m) => m.to === admin.email && m.subject.startsWith('Stock bajo'));
    expect(alerta, 'el administrador debería recibir la alerta').toBeTruthy();
    expect(alerta.subject).toContain(insumo.nombre);

    const { rows } = await query(`SELECT 1 FROM notificaciones WHERE user_id = $1 AND tipo = 'alerta_inventario'`, [admin.id]);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('sin quedar por debajo del mínimo no hay alerta', async () => {
    const insumo = await crearInsumo({ disponible: 10, minimo: 2 });
    const svc = await crearServicio();
    await asociarInsumo(svc.id, insumo.id, 1);
    const cita = (await agendar(hCliente, { servicio_id: svc.id })).body;
    vi.mocked(sendMail).mockClear();

    await api.put(`/api/citas/${cita.id}/atender`).set(hBarbero).expect(200);

    expect(vi.mocked(sendMail).mock.calls.some(([m]) => m.subject.startsWith('Stock bajo'))).toBe(false);
  });

  it('es una transacción: si el descuento falla la cita sigue confirmada y el stock intacto', async () => {
    const insumo = await crearInsumo({ disponible: 10 });
    const svc = await crearServicio();
    await asociarInsumo(svc.id, insumo.id, 1);
    const cita = (await agendar(hCliente, { servicio_id: svc.id })).body;

    // Un CHECK temporal hace fallar el UPDATE del descuento, después de que la cita ya se
    // marcó como atendida dentro de la transacción.
    await query('ALTER TABLE insumos DROP CONSTRAINT IF EXISTS zz_test_falla'); // por si una corrida anterior se interrumpió
    await query(`ALTER TABLE insumos ADD CONSTRAINT zz_test_falla CHECK (nombre NOT LIKE '${insumo.nombre}' OR cantidad_disponible >= 10)`);
    try {
      const res = await api.put(`/api/citas/${cita.id}/atender`).set(hBarbero);
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Ocurrió un error inesperado.');
    } finally {
      await query('ALTER TABLE insumos DROP CONSTRAINT IF EXISTS zz_test_falla');
    }

    expect((await query('SELECT estado FROM citas WHERE id = $1', [cita.id])).rows[0].estado).toBe('confirmada');
    expect(await stockDe(insumo.id)).toBe(10);
    expect((await query('SELECT 1 FROM insumo_movimientos WHERE insumo_id = $1', [insumo.id])).rowCount).toBe(0);
  });

  it('una cita cancelada no se puede marcar como atendida y no descuenta nada', async () => {
    const insumo = await crearInsumo({ disponible: 10 });
    const svc = await crearServicio();
    await asociarInsumo(svc.id, insumo.id, 2);
    const cita = (await agendar(hCliente, { servicio_id: svc.id })).body;
    await api.put(`/api/citas/${cita.id}/cancelar`).set(hCliente).expect(200);

    expect((await api.put(`/api/citas/${cita.id}/atender`).set(hBarbero)).status).toBe(409);
    expect(await stockDe(insumo.id)).toBe(10);
  });

  it('un cliente no puede marcar citas como atendidas', async () => {
    const cita = (await agendar(hCliente)).body;
    expect((await api.put(`/api/citas/${cita.id}/atender`).set(hCliente)).status).toBe(403);
  });

  it('una cita atendida ya no se puede cancelar', async () => {
    const cita = (await agendar(hCliente)).body;
    await api.put(`/api/citas/${cita.id}/atender`).set(hBarbero).expect(200);

    expect((await api.put(`/api/citas/${cita.id}/cancelar`).set(hCliente)).status).toBe(409);
  });
});

describe('cita walk-in', () => {
  it('el barbero registra una cita sin cuenta y con nombre; el cliente no puede', async () => {
    const fecha = nuevaFecha();
    const body = {
      servicio_id: servicio.id, barbero_id: barbero.perfilId, fecha, hora_inicio: '16:00', nombre_cliente: 'zz-test-walkin',
    };

    expect((await api.post('/api/citas/walkin').set(hCliente).send(body)).status).toBe(403);

    const res = await api.post('/api/citas/walkin').set(hBarbero).send(body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ es_walkin: true, estado: 'confirmada' });
  });
});
