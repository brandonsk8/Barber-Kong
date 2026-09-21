import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { ApiError } from '../../helpers/ApiError.js';

const TITULOS = {
  citas: 'Reporte de citas',
  ingresos: 'Reporte de ingresos',
  insumos: 'Reporte de consumo de insumos',
};

// Definición de columnas por tipo de reporte, reutilizada tanto por el export a Excel
// como al PDF para no duplicar qué campo va en qué columna.
const COLUMNAS = {
  citas: [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Hora', key: 'hora_inicio', width: 10 },
    { header: 'Servicio', key: 'servicio', width: 22 },
    { header: 'Barbero', key: 'barbero', width: 16 },
    { header: 'Cliente', key: 'cliente', width: 20 },
    { header: 'Estado', key: 'estado', width: 12 },
  ],
  ingresosPorServicio: [
    { header: 'Servicio', key: 'servicio', width: 25 },
    { header: 'Citas atendidas', key: 'citas_atendidas', width: 16 },
    { header: 'Ingresos (Q)', key: 'ingresos', width: 15 },
  ],
  ingresosPorBarbero: [
    { header: 'Barbero', key: 'barbero', width: 20 },
    { header: 'Citas atendidas', key: 'citas_atendidas', width: 16 },
    { header: 'Ingresos (Q)', key: 'ingresos', width: 15 },
  ],
  insumos: [
    { header: 'Insumo', key: 'insumo', width: 22 },
    { header: 'Unidad', key: 'unidad_medida', width: 12 },
    { header: 'Cantidad consumida', key: 'cantidad_consumida', width: 18 },
  ],
};

function assertRangoValido(desde, hasta) {
  if (desde > hasta) throw ApiError.badRequest('La fecha "desde" no puede ser posterior a "hasta".');
}

export function createReportesService({ repository }) {
  return {
    async generar({ tipo, desde, hasta }) {
      assertRangoValido(desde, hasta);

      if (tipo === 'citas') return repository.citasPorRango(desde, hasta);
      if (tipo === 'ingresos') return repository.ingresosPorRango(desde, hasta);
      return repository.consumoInsumosPorRango(desde, hasta);
    },

    // RF-REP-04: cada reporte debe poder exportarse tanto a Excel como a PDF -- las
    // dos funciones de abajo reciben los mismos datos de generar() y arman el archivo
    // en el formato pedido, sin volver a tocar la base de datos.
    async exportarExcel(tipo, data) {
      const workbook = new ExcelJS.Workbook();

      if (tipo === 'citas') {
        const sheet = workbook.addWorksheet('Citas');
        sheet.columns = COLUMNAS.citas;
        sheet.addRows(data.citas);
      } else if (tipo === 'ingresos') {
        const porServicio = workbook.addWorksheet('Por servicio');
        porServicio.columns = COLUMNAS.ingresosPorServicio;
        porServicio.addRows(data.porServicio);

        const porBarbero = workbook.addWorksheet('Por barbero');
        porBarbero.columns = COLUMNAS.ingresosPorBarbero;
        porBarbero.addRows(data.porBarbero);
      } else {
        const sheet = workbook.addWorksheet('Consumo de insumos');
        sheet.columns = COLUMNAS.insumos;
        sheet.addRows(data.consumo);
      }

      return workbook.xlsx.writeBuffer();
    },

    async exportarPDF(tipo, data) {
      const doc = new PDFDocument({ margin: 40 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

      doc.fontSize(16).text(TITULOS[tipo], { underline: true });
      doc.moveDown();

      if (tipo === 'citas') {
        renderTabla(doc, COLUMNAS.citas, data.citas);
        doc.moveDown();
        doc.fontSize(12).text('Resumen por estado:');
        Object.entries(data.resumenPorEstado).forEach(([estado, total]) => {
          doc.fontSize(10).text(`  ${estado}: ${total}`);
        });
      } else if (tipo === 'ingresos') {
        doc.fontSize(12).text('Ingresos por servicio');
        renderTabla(doc, COLUMNAS.ingresosPorServicio, data.porServicio);
        doc.moveDown();
        doc.fontSize(12).text('Ingresos por barbero');
        renderTabla(doc, COLUMNAS.ingresosPorBarbero, data.porBarbero);
        doc.moveDown();
        doc.fontSize(12).text(`Total de ingresos: Q${Number(data.totalIngresos).toFixed(2)}`);
      } else {
        renderTabla(doc, COLUMNAS.insumos, data.consumo);
      }

      doc.end();
      return done;
    },
  };
}

// Tabla simple, solo texto alineado por columnas (sin bordes) -- suficiente para un
// reporte administrativo, sin meter una librería de layout aparte.
function renderTabla(doc, columnas, rows) {
  const startX = doc.x;
  let y = doc.y;

  doc.fontSize(9).font('Helvetica-Bold');
  let x = startX;
  columnas.forEach((col) => {
    doc.text(col.header, x, y, { width: col.width * 5, continued: false });
    x += col.width * 5;
  });

  doc.font('Helvetica');
  y += 15;
  rows.forEach((row) => {
    x = startX;
    columnas.forEach((col) => {
      const value = row[col.key];
      doc.fontSize(9).text(value == null ? '' : String(value), x, y, { width: col.width * 5 });
      x += col.width * 5;
    });
    y += 15;
    if (y > doc.page.height - 60) {
      doc.addPage();
      y = doc.y;
    }
  });

  doc.y = y;
}
