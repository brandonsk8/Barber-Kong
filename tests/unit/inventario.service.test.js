import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('../../src/services/notification.service.js', () => ({ notify: mocks.notify }));

import { createInventarioService } from '../../src/modules/inventario/inventario.service.js';

const CLIENT = { query: vi.fn() };

function insumoTras(cantidad_disponible, cantidad_minima, over = {}) {
  return { id: 'i-1', nombre: 'Gel', unidad_medida: 'frasco', cantidad_disponible, cantidad_minima, ...over };
}

function fakeRepository(overrides = {}) {
  return {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    registrarEntrada: vi.fn(),
    findServicioInsumosTx: vi.fn().mockResolvedValue([]),
    descontarInsumoTx: vi.fn(),
    findAdminUsers: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notify.mockResolvedValue(undefined);
});

describe('inventario.service — descontarPorServicio (UC-16/UC-17)', () => {
  it('descuenta cada insumo del servicio con la cantidad configurada y ligado a la cita', async () => {
    const repository = fakeRepository({
      findServicioInsumosTx: vi.fn().mockResolvedValue([
        { insumo_id: 'i-1', cantidad_consumida: 2 },
        { insumo_id: 'i-2', cantidad_consumida: 1 },
      ]),
      descontarInsumoTx: vi.fn().mockResolvedValue(insumoTras(50, 3)),
    });

    await createInventarioService({ repository }).descontarPorServicio({ client: CLIENT, servicioId: 's-1', citaId: 'cita-1' });

    expect(repository.descontarInsumoTx).toHaveBeenCalledTimes(2);
    expect(repository.descontarInsumoTx).toHaveBeenNthCalledWith(1, CLIENT, 'i-1', 2, 'cita-1');
    expect(repository.descontarInsumoTx).toHaveBeenNthCalledWith(2, CLIENT, 'i-2', 1, 'cita-1');
  });

  it('un servicio sin insumos asociados no descuenta nada ni genera alertas', async () => {
    const repository = fakeRepository();
    const alertas = await createInventarioService({ repository }).descontarPorServicio({ client: CLIENT, servicioId: 's-1', citaId: 'c' });

    expect(alertas).toEqual([]);
    expect(repository.descontarInsumoTx).not.toHaveBeenCalled();
  });

  it('devuelve alerta solo de los insumos que quedaron por debajo del mínimo', async () => {
    const resultados = [insumoTras(2, 3, { id: 'i-bajo' }), insumoTras(10, 3, { id: 'i-ok' }), insumoTras(3, 3, { id: 'i-justo' })];
    const repository = fakeRepository({
      findServicioInsumosTx: vi.fn().mockResolvedValue(resultados.map((r) => ({ insumo_id: r.id, cantidad_consumida: 1 }))),
      descontarInsumoTx: vi.fn().mockImplementation(async (_c, id) => resultados.find((r) => r.id === id)),
    });

    const alertas = await createInventarioService({ repository }).descontarPorServicio({ client: CLIENT, servicioId: 's', citaId: 'c' });

    expect(alertas.map((a) => a.id)).toEqual(['i-bajo']); // 3 de mínimo 3 NO es "por debajo"
  });

  it('un insumo sin mínimo configurado nunca genera alerta, aunque llegue a cero o negativo', async () => {
    const repository = fakeRepository({
      findServicioInsumosTx: vi.fn().mockResolvedValue([{ insumo_id: 'i-1', cantidad_consumida: 5 }]),
      descontarInsumoTx: vi.fn().mockResolvedValue(insumoTras(-2, null)),
    });

    await expect(
      createInventarioService({ repository }).descontarPorServicio({ client: CLIENT, servicioId: 's', citaId: 'c' })
    ).resolves.toEqual([]);
  });
});

describe('inventario.service — notificarStockBajo', () => {
  it('no hace nada si no hay alertas (ni siquiera consulta a los administradores)', async () => {
    const repository = fakeRepository();
    await createInventarioService({ repository }).notificarStockBajo([]);

    expect(repository.findAdminUsers).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('avisa a cada administrador activo por cada insumo con stock bajo', async () => {
    const repository = fakeRepository({
      findAdminUsers: vi.fn().mockResolvedValue([
        { id: 'a-1', email: 'a1@x.com' },
        { id: 'a-2', email: 'a2@x.com' },
      ]),
    });

    await createInventarioService({ repository }).notificarStockBajo([insumoTras(2, 3), insumoTras(0, 1, { nombre: 'Tinte' })]);

    expect(mocks.notify).toHaveBeenCalledTimes(4); // 2 insumos x 2 administradores
    expect(mocks.notify.mock.calls.every(([n]) => n.tipo === 'alerta_inventario')).toBe(true);
    expect(mocks.notify.mock.calls[0][0]).toMatchObject({
      userId: 'a-1',
      email: 'a1@x.com',
      titulo: 'Stock bajo: Gel',
      datos: { insumo: { nombre: 'Gel', disponible: 2, minimo: 3 } },
    });
  });
});
