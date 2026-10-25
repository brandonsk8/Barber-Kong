import { describe, it, expect } from 'vitest';
import { validate } from '../../src/helpers/validate.js';
import { createInsumoSchema, updateInsumoSchema, entradaSchema } from '../../src/modules/inventario/inventario.schema.js';
import { asociarInsumoSchema } from '../../src/modules/servicios/servicios.schema.js';
import { createBarberoSchema, updateBarberoSchema, crearAusenciaSchema } from '../../src/modules/barberos/barberos.schema.js';
import { reporteQuerySchema } from '../../src/modules/reportes/reportes.schema.js';

const mensajeDe = (schema, datos) => {
  try {
    validate(schema, datos);
    return null;
  } catch (e) {
    return { status: e.status, message: e.message };
  }
};

describe('validate()', () => {
  it('devuelve los datos válidos y lanza ApiError 400 con el mensaje si no lo son', () => {
    expect(validate(entradaSchema, { cantidad: 3 })).toEqual({ cantidad: 3 });
    expect(mensajeDe(entradaSchema, { cantidad: 0 })).toMatchObject({ status: 400 });
  });

  it('rechaza campos que el schema no conoce (additionalProperties: false)', () => {
    expect(mensajeDe(entradaSchema, { cantidad: 3, extra: 'x' })).toMatchObject({ status: 400 });
  });
});

describe('inventario: cantidades', () => {
  it('las entradas son números mayores que cero (admiten decimales, p. ej. ml)', () => {
    for (const buena of [5, 0.5, 250]) expect(mensajeDe(entradaSchema, { cantidad: buena })).toBeNull();
    for (const mala of [0, -1, 'abc', null]) {
      expect(mensajeDe(entradaSchema, { cantidad: mala }), String(mala)).toMatchObject({ status: 400 });
    }
    expect(mensajeDe(entradaSchema, {})).toMatchObject({ status: 400 });
  });

  it('el mínimo de un insumo es >= 0 (o null / ausente para no tener alerta)', () => {
    expect(mensajeDe(createInsumoSchema, { nombre: 'Gel', unidad_medida: 'ml', cantidad_minima: 300 })).toBeNull();
    expect(mensajeDe(createInsumoSchema, { nombre: 'Gel', unidad_medida: 'ml', cantidad_minima: null })).toBeNull();
    expect(mensajeDe(createInsumoSchema, { nombre: 'Gel', unidad_medida: 'ml' })).toBeNull();
    expect(mensajeDe(createInsumoSchema, { nombre: 'Gel', unidad_medida: 'ml', cantidad_minima: -1 })).toMatchObject({ status: 400 });
    expect(mensajeDe(updateInsumoSchema, { cantidad_minima: -5 })).toMatchObject({ status: 400 });
  });

  it('un insumo exige nombre y unidad de medida, y no acepta el stock al crearlo', () => {
    expect(mensajeDe(createInsumoSchema, { unidad_medida: 'ml' })).toMatchObject({ status: 400 });
    expect(mensajeDe(createInsumoSchema, { nombre: 'Gel' })).toMatchObject({ status: 400 });
    expect(mensajeDe(createInsumoSchema, { nombre: 'Gel', unidad_medida: 'ml', cantidad_disponible: 50 })).toMatchObject({ status: 400 });
  });

  it('un servicio consume una cantidad mayor que cero de cada insumo', () => {
    const insumo_id = '11111111-1111-4111-8111-111111111111';
    for (const buena of [30, 2, 0.5]) {
      expect(mensajeDe(asociarInsumoSchema, { insumo_id, cantidad_consumida: buena })).toBeNull();
    }
    for (const mala of [0, -3]) {
      expect(mensajeDe(asociarInsumoSchema, { insumo_id, cantidad_consumida: mala })).toMatchObject({ status: 400 });
    }
    expect(mensajeDe(asociarInsumoSchema, { insumo_id: 'no-es-uuid', cantidad_consumida: 1 })).toMatchObject({ status: 400 });
    expect(mensajeDe(asociarInsumoSchema, { insumo_id })).toMatchObject({
      status: 400,
      message: expect.stringContaining('cuánto consume'),
    });
  });
});

describe('horario del barbero', () => {
  const base = { nombre: 'Luis', email: 'luis@x.com', password: 'Prueba123!' };
  const bloque = (over = {}) => ({ dia_semana: 1, hora_inicio: '09:00', hora_fin: '18:00', ...over });

  it('acepta un horario válido y también que no venga (se usa el de la barbería)', () => {
    expect(mensajeDe(createBarberoSchema, base)).toBeNull();
    expect(mensajeDe(createBarberoSchema, { ...base, horario: [bloque(), bloque({ dia_semana: 3 })] })).toBeNull();
    expect(mensajeDe(updateBarberoSchema, { horario: [bloque()] })).toBeNull();
  });

  it.each([
    ['hora con formato inválido', bloque({ hora_inicio: '9am' }), 'formato HH:MM'],
    ['hora fuera de rango', bloque({ hora_fin: '25:00' }), 'formato HH:MM'],
    ['día fuera de 0-6', bloque({ dia_semana: 9 }), 'de 0 (domingo) a 6'],
    ['día no entero', bloque({ dia_semana: 1.5 }), 'de 0 (domingo) a 6'],
  ])('rechaza %s con un mensaje que señala el campo', (_n, malo, texto) => {
    expect(mensajeDe(createBarberoSchema, { ...base, horario: [malo] })).toMatchObject({
      status: 400,
      message: expect.stringContaining(texto),
    });
  });

  it('rechaza un bloque incompleto y un horario vacío', () => {
    expect(mensajeDe(createBarberoSchema, { ...base, horario: [{ dia_semana: 1, hora_inicio: '09:00' }] })).toMatchObject({
      status: 400,
      message: expect.stringContaining('Falta la hora de fin'),
    });
    expect(mensajeDe(createBarberoSchema, { ...base, horario: [] })).toMatchObject({
      status: 400,
      message: expect.stringContaining('entre 1 y 28 bloques'),
    });
  });

  it('una ausencia exige una fecha AAAA-MM-DD', () => {
    expect(mensajeDe(crearAusenciaSchema, { fecha: '2026-11-03', motivo: 'Trámite' })).toBeNull();
    expect(mensajeDe(crearAusenciaSchema, {})).toMatchObject({ status: 400, message: expect.stringContaining('día en que no estarás') });
    expect(mensajeDe(crearAusenciaSchema, { fecha: '03/11/2026' })).toMatchObject({ status: 400 });
  });
});

describe('reportes', () => {
  const ok = { tipo: 'citas', formato: 'pdf', desde: '2026-10-01', hasta: '2026-10-31' };

  it('acepta cualquier combinación de tipo y formato válidos', () => {
    for (const tipo of ['citas', 'ingresos', 'insumos']) {
      for (const formato of ['pdf', 'excel']) expect(mensajeDe(reporteQuerySchema, { ...ok, tipo, formato })).toBeNull();
    }
  });

  it('rechaza tipo o formato desconocidos y fechas mal escritas', () => {
    expect(mensajeDe(reporteQuerySchema, { ...ok, tipo: 'otro' })).toMatchObject({ status: 400 });
    expect(mensajeDe(reporteQuerySchema, { ...ok, formato: 'word' })).toMatchObject({ status: 400 });
    expect(mensajeDe(reporteQuerySchema, { ...ok, desde: '1/10/2026' })).toMatchObject({ status: 400 });
    expect(mensajeDe(reporteQuerySchema, { tipo: 'citas' })).toMatchObject({ status: 400 });
  });
});
