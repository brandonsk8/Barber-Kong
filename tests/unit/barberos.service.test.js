import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBarberosService } from '../../src/modules/barberos/barberos.service.js';

// 2026-11-01 es domingo (0) y 2026-11-02 lunes (1).
const DOMINGO = '2026-11-01';
const LUNES = '2026-11-02';
const FUTURO = '2999-01-01';

const BARBERO = { id: 'b-1', user_id: 'u-barbero', nombre: 'José', is_active: true };

function bloque(dia_semana, hora_inicio, hora_fin) {
  return { dia_semana, hora_inicio, hora_fin };
}

function fakeRepository(overrides = {}) {
  return {
    findById: vi.fn().mockResolvedValue(BARBERO),
    findHorario: vi.fn().mockResolvedValue([]),
    findHorarioDelDia: vi.fn().mockResolvedValue([]),
    createWithUser: vi.fn().mockResolvedValue(BARBERO),
    update: vi.fn().mockResolvedValue(BARBERO),
    findAusencia: vi.fn().mockResolvedValue(null),
    findAusencias: vi.fn().mockResolvedValue([]),
    createAusencia: vi.fn(),
    deleteAusencia: vi.fn(),
    findCitasDelDia: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const NUEVO = { nombre: 'Luis', email: 'luis@x.com', password: 'Prueba123!' };

describe('barberos.service — horario al crear (UC-22)', () => {
  it('sin horario usa el de la barbería: domingo a jueves, 9:00-19:00', async () => {
    const repository = fakeRepository();
    await createBarberosService({ repository }).create(NUEVO);

    const { horario } = repository.createWithUser.mock.calls[0][0];
    expect(horario).toHaveLength(5);
    expect(horario.map((b) => b.dia_semana)).toEqual([0, 1, 2, 3, 4]);
    expect(horario.every((b) => b.hora_inicio === '09:00' && b.hora_fin === '19:00')).toBe(true);
  });

  it('rechaza un bloque cuyo fin no es posterior al inicio, indicando cuál', async () => {
    const service = createBarberosService({ repository: fakeRepository() });
    const horario = [bloque(1, '09:00', '12:00'), bloque(2, '14:00', '10:00')];

    await expect(service.create({ ...NUEVO, horario })).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/bloque 2 \(martes\).*fin.*posterior/),
    });
  });

  it('rechaza bloques traslapados del mismo día, pero permite mañana y tarde seguidos', async () => {
    const repository = fakeRepository();
    const service = createBarberosService({ repository });

    await expect(
      service.create({ ...NUEVO, horario: [bloque(1, '09:00', '13:00'), bloque(1, '12:00', '18:00')] })
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/lunes.*se traslapan/) });

    await expect(
      service.create({ ...NUEVO, horario: [bloque(1, '09:00', '13:00'), bloque(1, '13:00', '18:00')] })
    ).resolves.toBeTruthy();
  });

  it('un correo ya registrado devuelve 409', async () => {
    const repository = fakeRepository({
      createWithUser: vi.fn().mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' })),
    });

    await expect(createBarberosService({ repository }).create(NUEVO)).rejects.toMatchObject({
      status: 409,
      message: 'Ya existe una cuenta con ese correo.',
    });
  });
});

describe('barberos.service — editar (UC-23)', () => {
  it('con horario lo valida y lo manda al repositorio; sin horario no lo toca', async () => {
    const repository = fakeRepository();
    const service = createBarberosService({ repository });

    await service.update('b-1', { nombre: 'Nuevo', horario: [bloque(3, '09:00', '12:00')] });
    expect(repository.update).toHaveBeenLastCalledWith('b-1', { nombre: 'Nuevo' }, [bloque(3, '09:00', '12:00')]);

    await service.update('b-1', { nombre: 'Solo nombre' });
    expect(repository.update).toHaveBeenLastCalledWith('b-1', { nombre: 'Solo nombre' }, undefined);
  });

  it('un horario inválido no llega a guardarse', async () => {
    const repository = fakeRepository();
    const service = createBarberosService({ repository });

    await expect(service.update('b-1', { horario: [bloque(1, '18:00', '09:00')] })).rejects.toMatchObject({ status: 400 });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('devuelve 404 si el barbero no existe', async () => {
    const repository = fakeRepository({ update: vi.fn().mockResolvedValue(null) });
    await expect(createBarberosService({ repository }).update('x', { nombre: 'a' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('barberos.service — assertAtiende (agendar según horario y ausencias)', () => {
  const cita = (over = {}) => ({ barberoId: 'b-1', fecha: LUNES, horaInicio: '10:00', horaFin: '10:30', ...over });
  let repository;
  let service;

  beforeEach(() => {
    repository = fakeRepository({ findHorarioDelDia: vi.fn().mockResolvedValue([{ hora_inicio: '09:00', hora_fin: '19:00' }]) });
    service = createBarberosService({ repository });
  });

  it('acepta una cita dentro del bloque, incluso pegada a los extremos', async () => {
    await expect(service.assertAtiende(cita())).resolves.toBeUndefined();
    await expect(service.assertAtiende(cita({ horaInicio: '09:00', horaFin: '09:30' }))).resolves.toBeUndefined();
    await expect(service.assertAtiende(cita({ horaInicio: '18:30', horaFin: '19:00' }))).resolves.toBeUndefined();
  });

  it('rechaza una cita que empieza antes o termina después del bloque', async () => {
    await expect(service.assertAtiende(cita({ horaInicio: '08:30', horaFin: '09:00' }))).rejects.toMatchObject({ status: 409 });
    await expect(service.assertAtiende(cita({ horaInicio: '18:45', horaFin: '19:15' }))).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('fuera del horario'),
    });
  });

  it('rechaza un día en que el barbero no atiende y nombra el día', async () => {
    repository.findHorarioDelDia.mockResolvedValue([]);

    await expect(service.assertAtiende(cita({ fecha: DOMINGO }))).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('domingos'),
    });
    // consultó el día de la semana correcto (0 = domingo)
    expect(repository.findHorarioDelDia).toHaveBeenCalledWith('b-1', 0);
  });

  it('rechaza un día marcado como ausencia, aunque el horario lo permita', async () => {
    repository.findAusencia.mockResolvedValue({ id: 'a-1', fecha: LUNES });

    await expect(service.assertAtiende(cita())).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('no estará disponible'),
    });
  });

  it('con dos bloques, no deja agendar en el hueco entre ambos', async () => {
    repository.findHorarioDelDia.mockResolvedValue([
      { hora_inicio: '09:00', hora_fin: '13:00' },
      { hora_inicio: '15:00', hora_fin: '19:00' },
    ]);

    await expect(service.assertAtiende(cita({ horaInicio: '14:00', horaFin: '14:30' }))).rejects.toMatchObject({ status: 409 });
    await expect(service.assertAtiende(cita({ horaInicio: '15:00', horaFin: '15:30' }))).resolves.toBeUndefined();
  });

  it('rechaza una cita que cruza la medianoche', async () => {
    await expect(service.assertAtiende(cita({ horaInicio: '23:50', horaFin: '00:20' }))).rejects.toMatchObject({ status: 409 });
  });
});

describe('barberos.service — ausencias', () => {
  const admin = { id: 'u-admin', role: 'admin' };
  const propio = { id: 'u-barbero', role: 'barbero' };
  const otroBarbero = { id: 'u-otro', role: 'barbero' };
  const cliente = { id: 'u-cli', role: 'cliente' };

  it('solo el administrador o el propio barbero pueden gestionar la agenda', async () => {
    const service = createBarberosService({ repository: fakeRepository({ createAusencia: vi.fn().mockResolvedValue({ id: 'a' }) }) });

    await expect(service.crearAusencia('b-1', { fecha: FUTURO }, admin)).resolves.toBeTruthy();
    await expect(service.crearAusencia('b-1', { fecha: FUTURO }, propio)).resolves.toBeTruthy();
    await expect(service.crearAusencia('b-1', { fecha: FUTURO }, otroBarbero)).rejects.toMatchObject({ status: 403 });
    await expect(service.crearAusencia('b-1', { fecha: FUTURO }, cliente)).rejects.toMatchObject({ status: 403 });
    await expect(service.listAusencias('b-1', otroBarbero)).rejects.toMatchObject({ status: 403 });
    await expect(service.quitarAusencia('b-1', 'a', otroBarbero)).rejects.toMatchObject({ status: 403 });
  });

  it('no deja marcar un día que ya pasó', async () => {
    const repository = fakeRepository();
    const service = createBarberosService({ repository });

    await expect(service.crearAusencia('b-1', { fecha: '2000-01-01' }, propio)).rejects.toMatchObject({
      status: 400,
      message: 'No puedes marcar un día que ya pasó.',
    });
    expect(repository.createAusencia).not.toHaveBeenCalled();
  });

  it('no cancela citas por detrás: con citas ese día responde 409 con la cantidad', async () => {
    const repository = fakeRepository({ findCitasDelDia: vi.fn().mockResolvedValue([{}, {}]) });
    const service = createBarberosService({ repository });

    await expect(service.crearAusencia('b-1', { fecha: FUTURO }, propio)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('2 cita(s)'),
    });
    expect(repository.createAusencia).not.toHaveBeenCalled();
  });

  it('un día ya marcado devuelve 409', async () => {
    const repository = fakeRepository({
      createAusencia: vi.fn().mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' })),
    });

    await expect(createBarberosService({ repository }).crearAusencia('b-1', { fecha: FUTURO }, propio)).rejects.toMatchObject({
      status: 409,
      message: 'Ese día ya está marcado como no disponible.',
    });
  });

  it('quitar una ausencia que no existe devuelve 404', async () => {
    const repository = fakeRepository({ deleteAusencia: vi.fn().mockResolvedValue(false) });
    await expect(createBarberosService({ repository }).quitarAusencia('b-1', 'nada', propio)).rejects.toMatchObject({ status: 404 });
  });
});

describe('barberos.service — disponibilidad por fecha', () => {
  it('un día de ausencia no ofrece horas: trabaja=false, ausente=true, sin bloques', async () => {
    const repository = fakeRepository({
      findAusencia: vi.fn().mockResolvedValue({ id: 'a' }),
      findHorarioDelDia: vi.fn().mockResolvedValue([{ hora_inicio: '09:00', hora_fin: '19:00' }]),
    });

    await expect(createBarberosService({ repository }).getDisponibilidad('b-1', LUNES)).resolves.toMatchObject({
      trabaja: false,
      ausente: true,
      bloques: [],
    });
  });

  it('devuelve los bloques del día y las horas ocupadas por citas, ordenadas', async () => {
    const repository = fakeRepository({
      findHorarioDelDia: vi.fn().mockResolvedValue([{ hora_inicio: '09:00', hora_fin: '19:00' }]),
      findCitasDelDia: vi.fn().mockResolvedValue([
        { hora_inicio: '15:00:00', hora_fin: '15:30:00' },
        { hora_inicio: '10:00:00', hora_fin: '10:30:00' },
      ]),
    });

    const res = await createBarberosService({ repository }).getDisponibilidad('b-1', LUNES);

    expect(res).toMatchObject({ trabaja: true, ausente: false });
    expect(res.ocupadas).toEqual(['10:00', '15:00']);
    expect(res.bloques).toEqual([{ hora_inicio: '09:00', hora_fin: '19:00' }]);
  });
});
