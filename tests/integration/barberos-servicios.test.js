import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import {
  getApp, crearUsuario, crearServicio, login, fechaEn, unico, cerrar, PASSWORD,
} from '../helpers/fixtures.js';

let api, hAdmin, hCliente, hBarbero, cliente, barbero, otroBarbero, hOtroBarbero, servicio;

const INEXISTENTE = '11111111-1111-4111-8111-111111111111';
const bloque = (dia, ini, fin) => ({ dia_semana: dia, hora_inicio: ini, hora_fin: fin });

beforeAll(async () => {
  api = request(await getApp());
  const [admin, c, b, ob] = await Promise.all(['admin', 'cliente', 'barbero', 'barbero'].map((role) => crearUsuario({ role })));
  cliente = c; barbero = b; otroBarbero = ob;
  [hAdmin, hCliente, hBarbero, hOtroBarbero] = await Promise.all([admin, c, b, ob].map(login));
  servicio = await crearServicio({ duracion: 30 });
});
afterAll(cerrar);

describe('crear, editar y desactivar servicios (UC-12)', () => {
  const nuevo = (extra = {}) => api.post('/api/servicios').set(hAdmin).send({ nombre: unico('servicio'), duracion_minutos: 45, precio: 80, ...extra });

  it('el administrador crea un servicio y queda visible en el catálogo público', async () => {
    const res = await nuevo({ precio: 79.5 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ duracion_minutos: 45, is_active: true });
    expect(Number(res.body.precio)).toBe(79.5);

    const publico = (await api.get('/api/servicios')).body;
    expect(publico.some((s) => s.id === res.body.id)).toBe(true);
  });

  it('valida los datos con mensajes en español: obligatorios, duración entera y precio no negativo', async () => {
    const sinNombre = await api.post('/api/servicios').set(hAdmin).send({ duracion_minutos: 30, precio: 10 });
    expect(sinNombre.status).toBe(400);
    expect(sinNombre.body.message).toContain('nombre del servicio es obligatorio');

    expect((await nuevo({ duracion_minutos: 0 })).status).toBe(400);
    expect((await nuevo({ duracion_minutos: 30.5 })).status).toBe(400);
    expect((await nuevo({ precio: -1 })).status).toBe(400);
    expect((await nuevo({ extra: 'x' })).status).toBe(400);
  });

  it('editar cambia solo lo enviado; el administrador inexistente da 404', async () => {
    const { body: s } = await nuevo();

    const res = await api.put(`/api/servicios/${s.id}`).set(hAdmin).send({ precio: 120 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nombre: s.nombre, duracion_minutos: 45 });
    expect(Number(res.body.precio)).toBe(120);

    expect((await api.put(`/api/servicios/${INEXISTENTE}`).set(hAdmin).send({ precio: 1 })).status).toBe(404);
    expect((await api.get(`/api/servicios/${INEXISTENTE}`)).status).toBe(404);
    expect((await api.delete(`/api/servicios/${INEXISTENTE}`).set(hAdmin)).status).toBe(404);
  });

  it('cliente y barbero no pueden crear ni editar', async () => {
    const cuerpo = { nombre: unico('servicio'), duracion_minutos: 30, precio: 10 };
    expect((await api.post('/api/servicios').set(hCliente).send(cuerpo)).status).toBe(403);
    expect((await api.post('/api/servicios').set(hBarbero).send(cuerpo)).status).toBe(403);
    expect((await api.put(`/api/servicios/${servicio.id}`).set(hBarbero).send({ precio: 1 })).status).toBe(403);
  });
});

describe('gestión de barberos por el administrador (UC-22, UC-23, UC-24)', () => {
  const alta = (extra = {}) => {
    const nombre = unico('barbero');
    return api.post('/api/barberos').set(hAdmin).send({ nombre, email: `${nombre}@test.local`, password: PASSWORD, ...extra });
  };

  it('crea un barbero con su cuenta y, sin horario, le asigna el de la barbería (domingo a jueves, 9:00-19:00)', async () => {
    const res = await alta({ especialidad: 'Fade' });
    expect(res.status).toBe(201);

    const horario = (await api.get(`/api/barberos/${res.body.id}/horario`)).body;
    expect(horario).toEqual([0, 1, 2, 3, 4].map((d) => bloque(d, '09:00', '19:00')));

    // La cuenta funciona: el barbero entra con su correo y recibe su perfil de barbero.
    const entrar = await api.post('/api/auth/login').send({ email: res.body.email ?? `${res.body.nombre}@test.local`, password: PASSWORD });
    expect(entrar.status).toBe(200);
    expect(entrar.body.user).toMatchObject({ role: 'barbero', barberoId: res.body.id });
  });

  it('con horario propio lo guarda tal cual y también puede reemplazarlo al editar', async () => {
    const { body: b } = await alta({ horario: [bloque(1, '10:00', '13:00'), bloque(1, '14:00', '18:00')] });
    expect((await api.get(`/api/barberos/${b.id}/horario`)).body).toEqual([bloque(1, '10:00', '13:00'), bloque(1, '14:00', '18:00')]);

    const editado = await api.put(`/api/barberos/${b.id}`).set(hAdmin).send({ especialidad: 'Barba', horario: [bloque(3, '09:00', '12:00')] });
    expect(editado.status).toBe(200);
    expect(editado.body.especialidad).toBe('Barba');
    expect((await api.get(`/api/barberos/${b.id}/horario`)).body).toEqual([bloque(3, '09:00', '12:00')]);
  });

  it('rechaza un correo repetido (409), un horario inválido y datos incompletos', async () => {
    const { body: b } = await alta();
    const repetido = await api.post('/api/barberos').set(hAdmin).send({ nombre: unico('barbero'), email: `${b.nombre}@test.local`, password: PASSWORD });
    expect(repetido.status).toBe(409);

    const traslape = await alta({ horario: [bloque(1, '09:00', '12:00'), bloque(1, '11:00', '14:00')] });
    expect(traslape.status).toBe(400);
    expect(traslape.body.message).toContain('se traslapan');

    expect((await api.post('/api/barberos').set(hAdmin).send({ nombre: 'Sin correo' })).status).toBe(400);
  });

  it('desactivar saca al barbero del listado público pero el administrador aún lo ve', async () => {
    const { body: b } = await alta();
    const publico = async () => (await api.get('/api/barberos')).body.map((x) => x.id);

    expect(await publico()).toContain(b.id);
    expect((await api.delete(`/api/barberos/${b.id}`).set(hAdmin)).status).toBe(200);

    expect(await publico()).not.toContain(b.id);
    const admin = (await api.get('/api/barberos/admin').set(hAdmin)).body.find((x) => x.id === b.id);
    expect(admin).toMatchObject({ is_active: false });
  });

  it('un barbero desactivado ya no se puede reservar (404)', async () => {
    const { body: b } = await alta();
    await api.delete(`/api/barberos/${b.id}`).set(hAdmin).expect(200);

    const res = await api.post('/api/citas').set(hCliente).send({
      servicio_id: servicio.id, barbero_id: b.id, fecha: fechaEn(80), hora_inicio: '10:00',
    });
    expect(res.status).toBe(404);
  });

  it('inexistente da 404 y solo el administrador gestiona barberos', async () => {
    expect((await api.get(`/api/barberos/${INEXISTENTE}`)).status).toBe(404);
    expect((await api.put(`/api/barberos/${INEXISTENTE}`).set(hAdmin).send({ nombre: 'x' })).status).toBe(404);
    expect((await api.delete(`/api/barberos/${INEXISTENTE}`).set(hAdmin)).status).toBe(404);

    expect((await alta().then(() => api.post('/api/barberos').set(hBarbero).send({ nombre: 'x', email: 'x@test.local', password: PASSWORD }))).status).toBe(403);
    expect((await api.put(`/api/barberos/${barbero.perfilId}`).set(hBarbero).send({ nombre: 'x' })).status).toBe(403);
    expect((await api.delete(`/api/barberos/${barbero.perfilId}`).set(hCliente)).status).toBe(403);
  });
});

describe('agenda del barbero (RF-CIT-09)', () => {
  const agendar = (fecha, hora, extra = {}) => api.post('/api/citas').set(hCliente).send({
    servicio_id: servicio.id, barbero_id: barbero.perfilId, fecha, hora_inicio: hora, ...extra,
  });

  it('consulta de un día: trae las citas de ese barbero ordenadas por hora, con cliente y servicio', async () => {
    const fecha = fechaEn(90);
    await agendar(fecha, '15:00').expect(201);
    await agendar(fecha, '09:00').expect(201);
    await api.post('/api/citas').set(hCliente).send({
      servicio_id: servicio.id, barbero_id: otroBarbero.perfilId, fecha, hora_inicio: '09:00',
    }).expect(201);

    const res = await api.get('/api/citas').set(hBarbero).query({ barbero_id: barbero.perfilId, fecha });
    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.hora_inicio)).toEqual(['09:00:00', '15:00:00']);
    expect(res.body[0]).toMatchObject({ barbero_id: barbero.perfilId, servicio_nombre: servicio.nombre, cliente_nombre: cliente.nombre });
  });

  it('listado por rango (semanal): incluye varios días y se puede filtrar por barbero', async () => {
    const [d1, d2] = [fechaEn(95), fechaEn(97)];
    await agendar(d1, '10:00').expect(201);
    await agendar(d2, '10:00').expect(201);

    const rango = await api.get('/api/citas').set(hBarbero).query({ desde: d1, hasta: d2, barbero_id: barbero.perfilId });
    expect(rango.body.map((c) => c.fecha)).toEqual([d1, d2]);

    const todos = await api.get('/api/citas').set(hAdmin).query({ desde: d1, hasta: d2 });
    expect(todos.body.length).toBeGreaterThanOrEqual(2);
  });

  it('una cita cancelada sigue en la agenda pero marcada como cancelada', async () => {
    const fecha = fechaEn(100);
    const { body: c } = await agendar(fecha, '11:00').expect(201);
    await api.put(`/api/citas/${c.id}/cancelar`).set(hCliente).expect(200);

    const res = await api.get('/api/citas').set(hBarbero).query({ barbero_id: barbero.perfilId, fecha });
    expect(res.body.map((x) => x.estado)).toEqual(['cancelada']);
  });

  it('sin parámetros suficientes responde 400 y un cliente no puede ver la agenda (403)', async () => {
    expect((await api.get('/api/citas').set(hBarbero)).status).toBe(400);
    expect((await api.get('/api/citas').set(hBarbero).query({ desde: fechaEn(1) })).status).toBe(400);
    expect((await api.get('/api/citas').set(hCliente).query({ desde: fechaEn(1), hasta: fechaEn(2) })).status).toBe(403);
    expect((await api.get('/api/citas')).status).toBe(401);
  });
});
