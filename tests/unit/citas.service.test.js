import { describe, it, expect, vi, beforeEach } from 'vitest';

// Todo lo que el service de citas toca fuera de su repositorio se simula: aquí solo se prueba
// su lógica (reglas de agendado, avisos y la transacción de "marcar atendida").
const mocks = vi.hoisted(() => ({
  getClient: vi.fn(),
  notify: vi.fn(),
  assertAtiende: vi.fn(),
  descontarPorServicio: vi.fn(),
  notificarStockBajo: vi.fn(),
}));

vi.mock('../../src/config/db.js', () => ({ getClient: mocks.getClient, query: vi.fn(), pool: {} }));
vi.mock('../../src/services/notification.service.js', () => ({ notify: mocks.notify }));
vi.mock('../../src/modules/barberos/barberos.instance.js', () => ({
  barberosService: { assertAtiende: mocks.assertAtiende },
}));
vi.mock('../../src/modules/inventario/inventario.instance.js', () => ({
  inventarioService: {
    descontarPorServicio: mocks.descontarPorServicio,
    notificarStockBajo: mocks.notificarStockBajo,
  },
}));

import { createCitasService } from '../../src/modules/citas/citas.service.js';

const FUTURO = '2999-01-01';
const SERVICIO = { id: 's-1', nombre: 'Corte clásico', duracion_minutos: 30, is_active: true };
const BARBERO = { id: 'b-1', user_id: 'u-barbero', nombre: 'José M.', email: 'jose@x.com', is_active: true };
const CLIENTE = { id: 'c-1', nombre: 'Marta López', correo: 'marta@x.com' };

function fakeRepository(overrides = {}) {
  return {
    findClienteByUserId: vi.fn().mockResolvedValue(CLIENTE),
    findServicioById: vi.fn().mockResolvedValue(SERVICIO),
    findBarberoById: vi.fn().mockResolvedValue(BARBERO),
    existeSolapamiento: vi.fn().mockResolvedValue(false),
    create: vi.fn(async (datos) => ({ id: 'cita-1', ...datos })),
    createClienteWalkin: vi.fn(),
    findById: vi.fn(),
    setEstado: vi.fn(),
    setEstadoTx: vi.fn(),
    ...overrides,
  };
}

const datosCita = (over = {}) => ({
  userId: 'u-cliente',
  servicioId: 's-1',
  barberoId: 'b-1',
  fecha: FUTURO,
  horaInicio: '10:00',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assertAtiende.mockResolvedValue(undefined);
  mocks.notify.mockResolvedValue(undefined);
  mocks.descontarPorServicio.mockResolvedValue([]);
  mocks.notificarStockBajo.mockResolvedValue(undefined);
});

describe('citas.service — agendar', () => {
  it('crea la cita confirmada con la hora de fin según la duración del servicio', async () => {
    const repository = fakeRepository();
    const cita = await createCitasService({ repository }).crear(datosCita());

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'c-1', horaInicio: '10:00', horaFin: '10:30', estado: 'confirmada', esWalkin: false })
    );
    expect(cita.id).toBe('cita-1');
  });

  it('rechaza una fecha pasada sin consultar nada más', async () => {
    const repository = fakeRepository();

    await expect(createCitasService({ repository }).crear(datosCita({ fecha: '2000-01-01' }))).rejects.toMatchObject({ status: 400 });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('un servicio o un barbero inactivo o inexistente devuelve 404', async () => {
    const sinServicio = fakeRepository({ findServicioById: vi.fn().mockResolvedValue({ ...SERVICIO, is_active: false }) });
    const sinBarbero = fakeRepository({ findBarberoById: vi.fn().mockResolvedValue(null) });

    await expect(createCitasService({ repository: sinServicio }).crear(datosCita())).rejects.toMatchObject({ status: 404 });
    await expect(createCitasService({ repository: sinBarbero }).crear(datosCita())).rejects.toMatchObject({ status: 404 });
  });

  it('respeta el horario y las ausencias del barbero: si assertAtiende falla, no se crea nada', async () => {
    mocks.assertAtiende.mockRejectedValue(Object.assign(new Error('fuera de horario'), { status: 409 }));
    const repository = fakeRepository();

    await expect(createCitasService({ repository }).crear(datosCita())).rejects.toMatchObject({ status: 409 });
    expect(repository.create).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('evita la doble reserva: horario solapado devuelve 409', async () => {
    const repository = fakeRepository({ existeSolapamiento: vi.fn().mockResolvedValue(true) });

    await expect(createCitasService({ repository }).crear(datosCita())).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('ya no está disponible'),
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('un usuario sin perfil de cliente no puede agendar', async () => {
    const repository = fakeRepository({ findClienteByUserId: vi.fn().mockResolvedValue(null) });
    await expect(createCitasService({ repository }).crear(datosCita())).rejects.toMatchObject({ status: 400 });
  });
});

describe('citas.service — avisos al agendar', () => {
  it('avisa al cliente y también al barbero asignado', async () => {
    await createCitasService({ repository: fakeRepository() }).crear(datosCita());

    expect(mocks.notify).toHaveBeenCalledTimes(2);
    const [alCliente, alBarbero] = mocks.notify.mock.calls.map(([arg]) => arg);

    expect(alCliente).toMatchObject({ userId: 'u-cliente', email: 'marta@x.com', tipo: 'confirmacion_cita' });
    expect(alBarbero).toMatchObject({ userId: 'u-barbero', email: 'jose@x.com', tipo: 'confirmacion_cita' });
    expect(alBarbero.mensaje).toContain('Marta López');
    expect(alBarbero.datos.cita.cliente).toBe('Marta López');
  });

  it('el barbero se entera aunque el cliente no tenga correo', async () => {
    const repository = fakeRepository({ findClienteByUserId: vi.fn().mockResolvedValue({ ...CLIENTE, correo: null }) });
    await createCitasService({ repository }).crear(datosCita());

    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(mocks.notify.mock.calls[0][0].userId).toBe('u-barbero');
  });
});

describe('citas.service — marcar atendida (descuento de inventario en una transacción)', () => {
  const CITA = { id: 'cita-1', servicio_id: 's-1', estado: 'confirmada' };
  let client;

  beforeEach(() => {
    client = { query: vi.fn().mockResolvedValue({}), release: vi.fn() };
    mocks.getClient.mockResolvedValue(client);
  });

  const sentencias = () => client.query.mock.calls.map(([sql]) => sql);

  it('marca la cita y descuenta dentro de la misma transacción, y avisa solo después del COMMIT', async () => {
    const alertas = [{ nombre: 'Gel' }];
    mocks.descontarPorServicio.mockResolvedValue(alertas);
    const repository = fakeRepository({ findById: vi.fn().mockResolvedValue(CITA) });

    await createCitasService({ repository }).marcarAtendida('cita-1');

    expect(sentencias()).toEqual(['BEGIN', 'COMMIT']);
    expect(repository.setEstadoTx).toHaveBeenCalledWith(client, 'cita-1', 'atendida');
    expect(mocks.descontarPorServicio).toHaveBeenCalledWith({ client, servicioId: 's-1', citaId: 'cita-1' });
    expect(client.release).toHaveBeenCalledTimes(1);

    // el aviso de stock bajo se manda con las alertas y DESPUÉS de confirmar la transacción
    expect(mocks.notificarStockBajo).toHaveBeenCalledWith(alertas);
    const ordenCommit = client.query.mock.invocationCallOrder[sentencias().indexOf('COMMIT')];
    expect(mocks.notificarStockBajo.mock.invocationCallOrder[0]).toBeGreaterThan(ordenCommit);
  });

  it('si el descuento falla se revierte todo, se libera la conexión y no se avisa nada', async () => {
    mocks.descontarPorServicio.mockRejectedValue(new Error('falló el descuento'));
    const repository = fakeRepository({ findById: vi.fn().mockResolvedValue(CITA) });

    await expect(createCitasService({ repository }).marcarAtendida('cita-1')).rejects.toThrow('falló el descuento');

    expect(sentencias()).toEqual(['BEGIN', 'ROLLBACK']);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(mocks.notificarStockBajo).not.toHaveBeenCalled();
  });

  it('una cita ya atendida no vuelve a descontar (ni abre transacción)', async () => {
    const repository = fakeRepository({ findById: vi.fn().mockResolvedValue({ ...CITA, estado: 'atendida' }) });

    await createCitasService({ repository }).marcarAtendida('cita-1');

    expect(mocks.getClient).not.toHaveBeenCalled();
    expect(mocks.descontarPorServicio).not.toHaveBeenCalled();
  });

  it('una cita cancelada no se puede marcar como atendida; una inexistente da 404', async () => {
    const cancelada = fakeRepository({ findById: vi.fn().mockResolvedValue({ ...CITA, estado: 'cancelada' }) });
    const noExiste = fakeRepository({ findById: vi.fn().mockResolvedValue(null) });

    await expect(createCitasService({ repository: cancelada }).marcarAtendida('x')).rejects.toMatchObject({ status: 409 });
    await expect(createCitasService({ repository: noExiste }).marcarAtendida('x')).rejects.toMatchObject({ status: 404 });
    expect(mocks.getClient).not.toHaveBeenCalled();
  });
});

describe('citas.service — cancelar', () => {
  const CITA = { id: 'cita-1', cliente_id: 'c-1', estado: 'confirmada', servicio_nombre: 'Corte', fecha: FUTURO, hora_inicio: '10:00' };

  it('un cliente no puede cancelar la cita de otro cliente', async () => {
    const repository = fakeRepository({
      findById: vi.fn().mockResolvedValue({ ...CITA, cliente_id: 'c-OTRO' }),
      findClienteByUserId: vi.fn().mockResolvedValue(CLIENTE),
    });

    await expect(createCitasService({ repository }).cancelar('cita-1', { id: 'u-cliente', role: 'cliente' })).rejects.toMatchObject({
      status: 403,
    });
    expect(repository.setEstado).not.toHaveBeenCalled();
  });

  it('una cita atendida no se puede cancelar; el administrador sí puede cancelar una confirmada', async () => {
    const atendida = fakeRepository({ findById: vi.fn().mockResolvedValue({ ...CITA, estado: 'atendida' }) });
    await expect(createCitasService({ repository: atendida }).cancelar('cita-1', { id: 'u-a', role: 'admin' })).rejects.toMatchObject({ status: 409 });

    const repository = fakeRepository({
      findById: vi.fn().mockResolvedValue(CITA),
      setEstado: vi.fn().mockResolvedValue({ ...CITA, estado: 'cancelada' }),
    });
    const res = await createCitasService({ repository }).cancelar('cita-1', { id: 'u-a', role: 'admin' });

    expect(repository.setEstado).toHaveBeenCalledWith('cita-1', 'cancelada');
    expect(res.estado).toBe('cancelada');
  });
});
