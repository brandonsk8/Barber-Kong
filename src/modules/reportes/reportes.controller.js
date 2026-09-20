import * as repository from './reportes.repository.js';
import { createReportesService } from './reportes.service.js';
import { reporteQuerySchema } from './reportes.schema.js';
import { validate } from '../../helpers/validate.js';

const service = createReportesService({ repository });

const CONTENT_TYPES = {
  pdf: 'application/pdf',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const EXTENSIONES = { pdf: 'pdf', excel: 'xlsx' };

export async function generar(req, res, next) {
  try {
    const { tipo, formato, desde, hasta } = validate(reporteQuerySchema, req.query);

    const data = await service.generar({ tipo, desde, hasta });
    const archivo = formato === 'pdf' ? await service.exportarPDF(tipo, data) : await service.exportarExcel(tipo, data);

    res.setHeader('Content-Type', CONTENT_TYPES[formato]);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-${tipo}-${desde}-a-${hasta}.${EXTENSIONES[formato]}"`
    );
    res.send(archivo);
  } catch (err) {
    next(err);
  }
}
