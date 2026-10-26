import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { construirExcel, construirPDF } from '../../src/modules/reportes/reportes.formato.js';

const RANGO = { desde: '2026-10-01', hasta: '2026-10-31' };

const CITAS = {
  citas: [
    { fecha: '2026-10-05', hora_inicio: '09:00:00', estado: 'atendida', es_walkin: false, servicio: 'Corte clásico', barbero: 'José M.', cliente: 'Marta' },
    { fecha: '2026-10-06', hora_inicio: '15:30:00', estado: 'cancelada', es_walkin: true, servicio: 'Arreglo de barba', barbero: 'Luis R.', cliente: 'Walk-in' },
  ],
  resumenPorEstado: { atendida: 1, cancelada: 1 },
};

const INGRESOS = {
  porServicio: [
    { servicio: 'Corte clásico', citas_atendidas: '12', ingresos: '540.00' },
    { servicio: 'Combo corte + barba', citas_atendidas: '7', ingresos: '490.00' },
  ],
  porBarbero: [
    { barbero: 'José M.', citas_atendidas: '10', ingresos: '450.00' },
    { barbero: 'Luis R.', citas_atendidas: '9', ingresos: '580.00' },
  ],
  totalIngresos: 1030,
};

const INSUMOS = { consumo: [{ insumo: 'Shampoo', unidad_medida: 'botella', cantidad_consumida: '4' }] };

async function abrir(buffer) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  return libro;
}

const filas = (hoja) => {
  const out = [];
  hoja.eachRow((row) => out.push(row.values.slice(1)));
  return out;
};

const contarPaginas = (pdf) => (pdf.toString('latin1').match(/\/Type \/Page(?!s)/g) || []).length;

describe('Excel', () => {
  it('reporte de citas: título con la marca, resumen, encabezados y datos reales ordenables', async () => {
    const libro = await abrir(await construirExcel({ tipo: 'citas', data: CITAS, rango: RANGO }));
    const hoja = libro.getWorksheet('Citas');

    expect(libro.creator).toBe('Barber Kongs');
    expect(hoja.getCell(1, 1).value).toBe('Barber Kongs  ·  Reporte de citas');
    expect(hoja.getCell(2, 1).value).toContain('Periodo: 01/10/2026 al 31/10/2026');

    const todo = filas(hoja).flat();
    expect(todo).toContain('Total de citas:');
    const encabezado = filas(hoja).find((f) => f[0] === 'Fecha');
    expect(encabezado).toEqual(['Fecha', 'Hora', 'Servicio', 'Barbero', 'Cliente', 'Estado']);

    const primera = filas(hoja).find((f) => f[2] === 'Corte clásico');
    expect(primera[0]).toBeInstanceOf(Date); // fecha real, no texto
    expect(primera[1]).toBe('9:00 a. m.');
    expect(primera[5]).toBe('Atendida');

    expect(hoja.views[0]).toMatchObject({ state: 'frozen' });
    expect(hoja.autoFilter).toBeTruthy();
  });

  it('reporte de ingresos: una hoja por servicio y otra por barbero, con totales numéricos', async () => {
    const libro = await abrir(await construirExcel({ tipo: 'ingresos', data: INGRESOS, rango: RANGO }));

    expect(libro.worksheets.map((h) => h.name)).toEqual(['Por servicio', 'Por barbero']);

    const total = filas(libro.getWorksheet('Por servicio')).find((f) => f[0] === 'Total');
    expect(total[1]).toBe(19); // 12 + 7 citas
    expect(total[2]).toBe(1030); // 540 + 490
    expect(typeof total[2]).toBe('number');

    let celdaDinero;
    libro.getWorksheet('Por servicio').eachRow((row) => {
      if (row.getCell(1).value === 'Corte clásico') celdaDinero = row.getCell(3);
    });
    expect(celdaDinero.numFmt).toContain('Q');
  });

  it('reporte de insumos: cantidad consumida como número real', async () => {
    const libro = await abrir(await construirExcel({ tipo: 'insumos', data: INSUMOS, rango: RANGO }));
    const f = filas(libro.worksheets[0]);

    expect(f.find((r) => r[0] === 'Insumo')).toEqual(['Insumo', 'Unidad', 'Cantidad consumida']);
    expect(f.find((r) => r[0] === 'Shampoo')).toEqual(['Shampoo', 'botella', 4]);
  });

  it('un periodo sin datos muestra el aviso en vez de una tabla vacía', async () => {
    const libro = await abrir(await construirExcel({ tipo: 'citas', data: { citas: [], resumenPorEstado: {} }, rango: RANGO }));

    expect(filas(libro.getWorksheet('Citas')).flat()).toContain('No hay datos en el periodo seleccionado.');
    expect(libro.getWorksheet('Citas').autoFilter).toBeFalsy();
  });
});

describe('PDF', () => {
  it('genera un PDF válido con la marca en los metadatos', async () => {
    for (const [tipo, data] of [['citas', CITAS], ['ingresos', INGRESOS], ['insumos', INSUMOS]]) {
      const pdf = await construirPDF({ tipo, data, rango: RANGO });

      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.toString('latin1')).toContain('(Barber Kongs)'); // Author en el diccionario Info
      expect(pdf.length).toBeGreaterThan(1000);
    }
  });

  it('con muchas filas pagina en vez de cortar la tabla', async () => {
    const muchas = {
      citas: Array.from({ length: 80 }, (_, i) => ({
        fecha: '2026-10-05',
        hora_inicio: '09:00:00',
        estado: 'confirmada',
        es_walkin: false,
        servicio: 'Corte clásico',
        barbero: 'José M.',
        cliente: `Cliente número ${i}`,
      })),
      resumenPorEstado: { confirmada: 80 },
    };

    expect(contarPaginas(await construirPDF({ tipo: 'citas', data: CITAS, rango: RANGO }))).toBe(1);
    expect(contarPaginas(await construirPDF({ tipo: 'citas', data: muchas, rango: RANGO }))).toBeGreaterThan(1);
  });

  it('un periodo sin datos igual produce un PDF válido', async () => {
    const pdf = await construirPDF({ tipo: 'citas', data: { citas: [], resumenPorEstado: {} }, rango: RANGO });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
