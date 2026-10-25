import { ApiError } from '../../helpers/ApiError.js';
import { construirExcel, construirPDF } from './reportes.formato.js';

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

    // RF-REP-04: cada reporte debe poder exportarse tanto a Excel como a PDF. Reciben los
    // mismos datos de generar() más el rango (para rotular el periodo) y arman el archivo
    // sin volver a tocar la base de datos. Cómo se ve cada formato vive en reportes.formato.js.
    async exportarExcel(tipo, data, rango) {
      return construirExcel({ tipo, data, rango });
    },

    async exportarPDF(tipo, data, rango) {
      return construirPDF({ tipo, data, rango });
    },
  };
}
