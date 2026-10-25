// Presentación de los reportes (Excel y PDF) con la misma identidad visual de Barber Kong
// (negro cálido + dorado, como el landing). Aquí no hay SQL ni reglas de negocio: recibe
// los datos que ya armó el service y solo decide cómo se ven. Los dos formatos salen de
// la MISMA definición de reporte (`definirReporte`), así que columnas, totales y resumen
// nunca quedan distintos entre el Excel y el PDF (RF-REP-04).
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const C = {
  oscuro: '1A1612',
  dorado: 'C9A15B',
  crema: 'FAF6EE',
  cremaOscuro: 'F1E8D4',
  borde: 'E7E0D4',
  texto: '2B2622',
  atenuado: '7A7068',
  claro: 'F3EDE2',
};

// Estado de la cita -> colores (fondo / texto), para que se lea de un vistazo.
const ESTADOS = {
  atendida: { fondo: 'DDEFD9', texto: '2F6B2A', etiqueta: 'Atendida' },
  confirmada: { fondo: 'E3ECF7', texto: '2B5C8F', etiqueta: 'Confirmada' },
  pendiente: { fondo: 'FFF1CC', texto: '8A6A00', etiqueta: 'Pendiente' },
  cancelada: { fondo: 'F6D9D2', texto: '9A3B1F', etiqueta: 'Cancelada' },
};

// ---------- formatos de valor -------------------------------------------------------

const num = (n) => Number(n) || 0;
const numeroEs = (n, dec) =>
  num(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });

// "2026-09-27" -> "27/09/2026"
function fechaCorta(fecha) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(fecha ?? '');
}

// "15:30:00" -> "3:30 p. m."
function horaCorta(hora) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hora ?? ''));
  if (!m) return String(hora ?? '');
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? 'p. m.' : 'a. m.'}`;
}

function generadoEl() {
  return new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Guatemala',
  }).format(new Date());
}

// Texto de una celda según el tipo de columna (lo usa el PDF; el Excel guarda el valor
// real con su formato numérico para que se pueda ordenar, filtrar y sumar).
function textoCelda(formato, valor) {
  switch (formato) {
    case 'fecha':
      return fechaCorta(valor);
    case 'hora':
      return horaCorta(valor);
    case 'moneda':
      return `Q${numeroEs(valor, 2)}`;
    case 'entero':
      return numeroEs(valor, 0);
    case 'decimal':
      return numeroEs(valor, 2);
    case 'estado':
      return ESTADOS[valor]?.etiqueta ?? String(valor ?? '');
    default:
      return valor == null ? '' : String(valor);
  }
}

// ---------- definición de cada reporte ----------------------------------------------

const TITULOS = {
  citas: 'Reporte de citas',
  ingresos: 'Reporte de ingresos',
  insumos: 'Reporte de consumo de insumos',
};

function definirReporte(tipo, data) {
  if (tipo === 'citas') {
    const r = data.resumenPorEstado || {};
    return {
      titulo: TITULOS.citas,
      resumen: [
        { etiqueta: 'Total de citas', valor: data.citas.length, formato: 'entero' },
        { etiqueta: 'Atendidas', valor: r.atendida || 0, formato: 'entero' },
        { etiqueta: 'Confirmadas', valor: r.confirmada || 0, formato: 'entero' },
        { etiqueta: 'Canceladas', valor: r.cancelada || 0, formato: 'entero' },
      ],
      secciones: [
        {
          hoja: 'Citas',
          titulo: 'Detalle de citas',
          columnas: [
            { header: 'Fecha', key: 'fecha', formato: 'fecha', ancho: 12, align: 'center' },
            { header: 'Hora', key: 'hora_inicio', formato: 'hora', ancho: 14, align: 'center' },
            { header: 'Servicio', key: 'servicio', ancho: 24 },
            { header: 'Barbero', key: 'barbero', ancho: 16 },
            { header: 'Cliente', key: 'cliente', ancho: 26 },
            { header: 'Estado', key: 'estado', formato: 'estado', ancho: 13, align: 'center' },
          ],
          filas: data.citas,
        },
      ],
    };
  }

  if (tipo === 'ingresos') {
    const totalCitas = data.porServicio.reduce((s, f) => s + num(f.citas_atendidas), 0);
    const seccion = (hoja, titulo, clave, etiqueta, filas) => ({
      hoja,
      titulo,
      columnas: [
        { header: etiqueta, key: clave, ancho: 28 },
        { header: 'Citas atendidas', key: 'citas_atendidas', formato: 'entero', ancho: 17, align: 'right' },
        { header: 'Ingresos', key: 'ingresos', formato: 'moneda', ancho: 17, align: 'right' },
      ],
      filas,
      totales: {
        [clave]: 'Total',
        citas_atendidas: filas.reduce((s, f) => s + num(f.citas_atendidas), 0),
        ingresos: filas.reduce((s, f) => s + num(f.ingresos), 0),
      },
    });
    return {
      titulo: TITULOS.ingresos,
      resumen: [
        { etiqueta: 'Ingresos totales', valor: data.totalIngresos, formato: 'moneda' },
        { etiqueta: 'Citas atendidas', valor: totalCitas, formato: 'entero' },
      ],
      secciones: [
        seccion('Por servicio', 'Ingresos por servicio', 'servicio', 'Servicio', data.porServicio),
        seccion('Por barbero', 'Ingresos por barbero', 'barbero', 'Barbero', data.porBarbero),
      ],
    };
  }

  return {
    titulo: TITULOS.insumos,
    resumen: [{ etiqueta: 'Insumos con consumo', valor: data.consumo.length, formato: 'entero' }],
    secciones: [
      {
        hoja: 'Consumo de insumos',
        titulo: 'Consumo de insumos por periodo',
        columnas: [
          { header: 'Insumo', key: 'insumo', ancho: 28 },
          { header: 'Unidad', key: 'unidad_medida', ancho: 14, align: 'center' },
          { header: 'Cantidad consumida', key: 'cantidad_consumida', formato: 'decimal', ancho: 22, align: 'right' },
        ],
        filas: data.consumo,
      },
    ],
  };
}

const subtituloRango = (rango) => `Periodo: ${fechaCorta(rango.desde)} al ${fechaCorta(rango.hasta)}`;
const MENSAJE_VACIO = 'No hay datos en el periodo seleccionado.';

// ======================================================================================
// EXCEL
// ======================================================================================

const rgb = (hex) => ({ argb: `FF${hex}` });
const relleno = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: rgb(hex) });
const lineaFina = { style: 'thin', color: rgb(C.borde) };
const bordes = { top: lineaFina, left: lineaFina, bottom: lineaFina, right: lineaFina };

const FORMATO_NUMERICO = {
  fecha: 'dd/mm/yyyy',
  moneda: '"Q"#,##0.00',
  entero: '#,##0',
  decimal: '#,##0.00',
};

// El valor real queda en la celda (fecha como fecha, dinero como número) y el formato
// solo cambia cómo se muestra: así el Excel se puede filtrar, ordenar y sumar.
function valorExcel(formato, valor) {
  if (formato === 'fecha') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor ?? ''));
    return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : valor;
  }
  if (formato === 'moneda' || formato === 'entero' || formato === 'decimal') return num(valor);
  if (formato === 'hora' || formato === 'estado') return textoCelda(formato, valor);
  return valor ?? '';
}

export async function construirExcel({ tipo, data, rango }) {
  const def = definirReporte(tipo, data);
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Barber Kong';
  libro.created = new Date();

  def.secciones.forEach((sec, indice) => {
    const hoja = libro.addWorksheet(sec.hoja, {
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const n = sec.columnas.length;
    sec.columnas.forEach((col, i) => {
      hoja.getColumn(i + 1).width = col.ancho + 2;
    });
    const unir = (fila) => hoja.mergeCells(fila, 1, fila, n);

    // Banda de título
    unir(1);
    const titulo = hoja.getCell(1, 1);
    titulo.value = `Barber Kong  ·  ${def.titulo}`;
    titulo.font = { name: 'Calibri', size: 16, bold: true, color: rgb(C.dorado) };
    titulo.fill = relleno(C.oscuro);
    titulo.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    hoja.getRow(1).height = 32;

    // Periodo y fecha de generación
    unir(2);
    const sub = hoja.getCell(2, 1);
    sub.value = `${subtituloRango(rango)}   ·   Generado: ${generadoEl()}`;
    sub.font = { name: 'Calibri', size: 10, italic: true, color: rgb(C.claro) };
    sub.fill = relleno(C.oscuro);
    sub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    hoja.getRow(2).height = 20;

    let fila = 4;

    // Resumen (solo en la primera hoja): una línea por indicador
    if (indice === 0) {
      def.resumen.forEach((item) => {
        const etiqueta = hoja.getCell(fila, 1);
        etiqueta.value = `${item.etiqueta}:`;
        etiqueta.font = { name: 'Calibri', size: 11, bold: true, color: rgb(C.atenuado) };
        const valor = hoja.getCell(fila, 2);
        valor.value = valorExcel(item.formato, item.valor);
        valor.numFmt = FORMATO_NUMERICO[item.formato];
        valor.font = { name: 'Calibri', size: 12, bold: true, color: rgb(C.oscuro) };
        valor.alignment = { horizontal: 'left' };
        fila += 1;
      });
      fila += 1;
    }

    // Título de la sección
    unir(fila);
    const secTitulo = hoja.getCell(fila, 1);
    secTitulo.value = sec.titulo;
    secTitulo.font = { name: 'Calibri', size: 13, bold: true, color: rgb(C.oscuro) };
    secTitulo.border = { bottom: { style: 'medium', color: rgb(C.dorado) } };
    for (let c = 2; c <= n; c += 1) hoja.getCell(fila, c).border = { bottom: { style: 'medium', color: rgb(C.dorado) } };
    hoja.getRow(fila).height = 22;
    fila += 2;

    // Encabezados de la tabla
    const filaEncabezado = fila;
    sec.columnas.forEach((col, i) => {
      const cel = hoja.getCell(fila, i + 1);
      cel.value = col.header;
      cel.font = { name: 'Calibri', size: 11, bold: true, color: rgb(C.oscuro) };
      cel.fill = relleno(C.dorado);
      cel.border = bordes;
      cel.alignment = { vertical: 'middle', horizontal: col.align || 'left', wrapText: true };
    });
    hoja.getRow(fila).height = 22;
    fila += 1;

    // Filas de datos (cebra suave) o aviso de reporte vacío
    if (sec.filas.length === 0) {
      unir(fila);
      const vacio = hoja.getCell(fila, 1);
      vacio.value = MENSAJE_VACIO;
      vacio.font = { name: 'Calibri', size: 11, italic: true, color: rgb(C.atenuado) };
      vacio.alignment = { horizontal: 'center', vertical: 'middle' };
      vacio.border = bordes;
      hoja.getRow(fila).height = 26;
      fila += 1;
    } else {
      sec.filas.forEach((registro, k) => {
        sec.columnas.forEach((col, i) => {
          const cel = hoja.getCell(fila, i + 1);
          cel.value = valorExcel(col.formato, registro[col.key]);
          if (FORMATO_NUMERICO[col.formato]) cel.numFmt = FORMATO_NUMERICO[col.formato];
          cel.font = { name: 'Calibri', size: 11, color: rgb(C.texto) };
          cel.fill = relleno(k % 2 ? C.crema : 'FFFFFF');
          cel.border = bordes;
          cel.alignment = { vertical: 'middle', horizontal: col.align || 'left' };

          if (col.formato === 'estado' && ESTADOS[registro[col.key]]) {
            const e = ESTADOS[registro[col.key]];
            cel.fill = relleno(e.fondo);
            cel.font = { name: 'Calibri', size: 11, bold: true, color: rgb(e.texto) };
          }
        });
        fila += 1;
      });
    }
    const ultimaFilaDatos = fila - 1;

    // Fila de totales (separada por una fila en blanco para no entrar en el filtro)
    if (sec.totales && sec.filas.length > 0) {
      fila += 1;
      sec.columnas.forEach((col, i) => {
        const cel = hoja.getCell(fila, i + 1);
        cel.value = valorExcel(col.formato, sec.totales[col.key]);
        if (FORMATO_NUMERICO[col.formato]) cel.numFmt = FORMATO_NUMERICO[col.formato];
        cel.font = { name: 'Calibri', size: 11, bold: true, color: rgb(C.oscuro) };
        cel.fill = relleno(C.cremaOscuro);
        cel.border = { ...bordes, top: { style: 'medium', color: rgb(C.dorado) } };
        cel.alignment = { vertical: 'middle', horizontal: col.align || 'left' };
      });
      hoja.getRow(fila).height = 22;
    }

    // Encabezado fijo al hacer scroll, filtro en los encabezados y repetición al imprimir
    hoja.views = [{ state: 'frozen', ySplit: filaEncabezado }];
    if (sec.filas.length > 0) {
      hoja.autoFilter = {
        from: { row: filaEncabezado, column: 1 },
        to: { row: ultimaFilaDatos, column: n },
      };
    }
    hoja.pageSetup.printTitlesRow = `${filaEncabezado}:${filaEncabezado}`;
  });

  return libro.xlsx.writeBuffer();
}

// ======================================================================================
// PDF
// ======================================================================================

const hexPdf = (hex) => `#${hex}`;
const MARGEN = 40;
const PIE = 60; // espacio reservado abajo para el pie de página

function dibujarEncabezadoPdf(doc, def, rango) {
  const ancho = doc.page.width;
  const util = ancho - MARGEN * 2;

  doc.rect(0, 0, ancho, 84).fill(hexPdf(C.oscuro));
  doc.rect(0, 84, ancho, 3).fill(hexPdf(C.dorado));

  doc.font('Times-Roman').fontSize(24).fillColor(hexPdf(C.claro));
  doc.text('Barber', MARGEN, 26, { continued: true, lineBreak: false });
  doc.fillColor(hexPdf(C.dorado)).text('Kong', { lineBreak: false });

  doc.font('Helvetica-Bold').fontSize(14).fillColor(hexPdf(C.claro));
  doc.text(def.titulo, MARGEN, 24, { width: util, align: 'right', lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor(hexPdf(C.dorado));
  doc.text(subtituloRango(rango), MARGEN, 46, { width: util, align: 'right', lineBreak: false });
  doc.fillColor(hexPdf(C.claro)).text(`Generado: ${generadoEl()}`, MARGEN, 60, {
    width: util,
    align: 'right',
    lineBreak: false,
  });

  return 108;
}

function dibujarResumenPdf(doc, resumen, y) {
  const util = doc.page.width - MARGEN * 2;
  const hueco = 12;
  const ancho = (util - hueco * (resumen.length - 1)) / resumen.length;
  const alto = 54;

  resumen.forEach((item, i) => {
    const x = MARGEN + i * (ancho + hueco);
    doc.roundedRect(x, y, ancho, alto, 4).fillAndStroke(hexPdf(C.crema), hexPdf(C.borde));
    doc.rect(x, y, 4, alto).fill(hexPdf(C.dorado));
    doc.font('Helvetica-Bold').fontSize(19).fillColor(hexPdf(C.oscuro));
    doc.text(textoCelda(item.formato, item.valor), x + 14, y + 10, { width: ancho - 20, lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor(hexPdf(C.atenuado));
    doc.text(item.etiqueta, x + 14, y + 35, { width: ancho - 20, lineBreak: false });
  });

  return y + alto + 22;
}

function anchosColumnas(columnas, util) {
  const total = columnas.reduce((s, c) => s + c.ancho, 0);
  return columnas.map((c) => (c.ancho / total) * util);
}

function dibujarTablaPdf(doc, sec, yInicial) {
  const util = doc.page.width - MARGEN * 2;
  const anchos = anchosColumnas(sec.columnas, util);
  const PAD_X = 6;
  const PAD_Y = 5;
  const limite = () => doc.page.height - PIE;
  let y = yInicial;

  // Título de la sección con subrayado dorado
  doc.font('Helvetica-Bold').fontSize(12).fillColor(hexPdf(C.oscuro));
  doc.text(sec.titulo, MARGEN, y, { width: util, lineBreak: false });
  doc.rect(MARGEN, y + 18, util, 1.5).fill(hexPdf(C.dorado));
  y += 30;

  // Una fila: alto según el texto más largo, fondo, texto por columna y línea inferior.
  const dibujarFila = (celdas, { fondo, fuente = 'Helvetica', color = C.texto, grosor = 0.5 }) => {
    doc.font(fuente).fontSize(9);
    const alto =
      Math.max(...celdas.map((c, i) => doc.heightOfString(c.texto, { width: anchos[i] - PAD_X * 2 }))) + PAD_Y * 2;

    if (y + alto > limite()) {
      doc.addPage();
      y = MARGEN;
      dibujarEncabezado();
    }

    if (fondo) doc.rect(MARGEN, y, util, alto).fill(hexPdf(fondo));
    let x = MARGEN;
    celdas.forEach((c, i) => {
      doc.font(c.fuente || fuente).fontSize(9).fillColor(hexPdf(c.color || color));
      doc.text(c.texto, x + PAD_X, y + PAD_Y, { width: anchos[i] - PAD_X * 2, align: c.align || 'left' });
      x += anchos[i];
    });
    doc.moveTo(MARGEN, y + alto).lineTo(MARGEN + util, y + alto).lineWidth(grosor).stroke(hexPdf(C.borde));
    y += alto;
  };

  // Se repite al inicio de cada página cuando la tabla continúa.
  function dibujarEncabezado() {
    dibujarFila(
      sec.columnas.map((c) => ({ texto: c.header, align: c.align })),
      { fondo: C.dorado, fuente: 'Helvetica-Bold', color: C.oscuro, grosor: 0 }
    );
  }
  dibujarEncabezado();

  if (sec.filas.length === 0) {
    doc.rect(MARGEN, y, util, 32).fill(hexPdf(C.crema));
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(hexPdf(C.atenuado));
    doc.text(MENSAJE_VACIO, MARGEN, y + 10, { width: util, align: 'center', lineBreak: false });
    return y + 32 + 24;
  }

  sec.filas.forEach((registro, k) => {
    dibujarFila(
      sec.columnas.map((c) => {
        const celda = { texto: textoCelda(c.formato, registro[c.key]), align: c.align };
        const estado = c.formato === 'estado' && ESTADOS[registro[c.key]];
        if (estado) Object.assign(celda, { fuente: 'Helvetica-Bold', color: estado.texto });
        return celda;
      }),
      { fondo: k % 2 ? C.crema : null }
    );
  });

  if (sec.totales) {
    dibujarFila(
      sec.columnas.map((c) => ({ texto: textoCelda(c.formato, sec.totales[c.key]), align: c.align })),
      { fondo: C.cremaOscuro, fuente: 'Helvetica-Bold', color: C.oscuro }
    );
  }

  return y + 24;
}

export function construirPDF({ tipo, data, rango }) {
  const def = definirReporte(tipo, data);
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGEN,
    bufferPages: true,
    info: { Title: `Barber Kong — ${def.titulo}`, Author: 'Barber Kong' },
  });

  const trozos = [];
  doc.on('data', (t) => trozos.push(t));
  const terminado = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);
  });

  let y = dibujarEncabezadoPdf(doc, def, rango);
  y = dibujarResumenPdf(doc, def.resumen, y);
  def.secciones.forEach((sec) => {
    // Evita dejar un título de sección huérfano al final de una página.
    if (y + 80 > doc.page.height - PIE) {
      doc.addPage();
      y = MARGEN;
    }
    y = dibujarTablaPdf(doc, sec, y);
  });

  // Pie de página con numeración. Se baja el margen inferior a 0 mientras se escribe
  // para que pdfkit no abra una página nueva al escribir tan abajo.
  const { count } = doc.bufferedPageRange();
  const util = doc.page.width - MARGEN * 2;
  for (let i = 0; i < count; i += 1) {
    doc.switchToPage(i);
    const margenAbajo = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const yPie = doc.page.height - 32;
    doc.font('Helvetica').fontSize(8).fillColor(hexPdf(C.atenuado));
    doc.text(`Barber Kong · ${def.titulo}`, MARGEN, yPie, { width: util / 2, align: 'left', lineBreak: false });
    doc.text(`Página ${i + 1} de ${count}`, MARGEN + util / 2, yPie, { width: util / 2, align: 'right', lineBreak: false });
    doc.page.margins.bottom = margenAbajo;
  }

  doc.end();
  return terminado;
}
