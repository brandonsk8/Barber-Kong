import { describe, it, expect } from 'vitest';
import { renderEmail, formatFecha, formatHora } from '../../src/services/emailTemplate.js';

const CITA = { servicio: 'Corte clásico', barbero: 'José M.', fecha: '2026-11-01', hora: '15:30:00' };

const TIPOS = [
  ['dos_factor', { codigo: '048213', vence: '10 minutos' }],
  ['recuperacion_password', { accion: { texto: 'Restablecer', url: 'https://app.test/restablecer?token=abc' } }],
  ['confirmacion_cita', { cita: CITA }],
  ['reprogramacion_cita', { cita: CITA }],
  ['cancelacion_cita', { cita: CITA }],
  ['alerta_inventario', { insumo: { nombre: 'Gel', disponible: 2, unidad: 'frasco', minimo: 3 } }],
];

describe('renderEmail — marca', () => {
  it.each(TIPOS)('%s usa "Barber Kongs" y nunca la marca vieja', (tipo, datos) => {
    const { html, text } = renderEmail({ tipo, titulo: 'Asunto — Barber Kongs', mensaje: 'm', datos });

    expect(html).toMatch(/Barber\s*<span[^>]*>Kongs<\/span>/); // logo del encabezado
    expect(html + text).not.toMatch(/Barber ?Kong(?!s)/);
  });
});

describe('renderEmail — contenido', () => {
  it('muestra el código de 2FA y su vencimiento', () => {
    const { html, text } = renderEmail({ tipo: 'dos_factor', titulo: 't', mensaje: 'm', datos: TIPOS[0][1] });

    expect(html).toContain('048213');
    expect(html).toContain('Vence en 10 minutos');
    expect(text).toContain('Código: 048213');
  });

  it('arma el detalle de la cita con fecha larga y hora de 12 horas', () => {
    const { html, text } = renderEmail({ tipo: 'confirmacion_cita', titulo: 't', mensaje: 'm', datos: { cita: CITA } });

    expect(html).toContain('domingo, 1 de noviembre de 2026');
    expect(html).toContain('3:30 p. m.');
    expect(text).toContain('Servicio: Corte clásico');
    expect(text).toContain('Barbero: José M.');
  });

  it('el aviso al barbero muestra el cliente y no repite al barbero; los textos se pueden reemplazar', () => {
    const { html } = renderEmail({
      tipo: 'confirmacion_cita',
      titulo: 't',
      mensaje: 'm',
      datos: {
        textos: { encabezado: 'Tienes una nueva cita', intro: 'Un cliente agendó contigo:' },
        cita: { cliente: 'Marta López', servicio: 'Corte clásico', fecha: '2026-11-01', hora: '10:00' },
      },
    });

    expect(html).toContain('Tienes una nueva cita');
    expect(html).toContain('Marta López');
    expect(html).not.toContain('Barbero</td>');
    expect(html).not.toContain('¡Tu cita está confirmada!');
  });

  it('sin `datos` igual sale presentable con el mensaje', () => {
    const { html } = renderEmail({ tipo: 'otro', titulo: 'Aviso', mensaje: 'Hola mundo' });

    expect(html).toContain('Aviso');
    expect(html).toContain('Hola mundo');
  });
});

describe('renderEmail — seguridad', () => {
  it('escapa el HTML de los valores dinámicos', () => {
    const { html } = renderEmail({
      tipo: 'confirmacion_cita',
      titulo: 't',
      mensaje: 'm',
      datos: { cita: { ...CITA, servicio: '<script>alert(1)</script>' } },
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('no pone como botón un enlace que no sea http(s)', () => {
    const { html, text } = renderEmail({
      tipo: 'recuperacion_password',
      titulo: 't',
      mensaje: 'm',
      datos: { accion: { texto: 'Clic', url: 'javascript:alert(1)' } },
    });

    expect(html).not.toContain('javascript:');
    expect(text).not.toContain('javascript:');
  });
});

describe('formatos de fecha y hora', () => {
  it('formatFecha no depende de la zona horaria (fecha solo-día)', () => {
    expect(formatFecha('2026-09-27')).toBe('domingo, 27 de septiembre de 2026');
    expect(formatFecha('2026-01-01')).toBe('jueves, 1 de enero de 2026');
  });

  it('formatHora pasa a 12 horas con a. m./p. m.', () => {
    expect(formatHora('09:05:00')).toBe('9:05 a. m.');
    expect(formatHora('12:00')).toBe('12:00 p. m.');
    expect(formatHora('00:30')).toBe('12:30 a. m.');
    expect(formatHora('19:00')).toBe('7:00 p. m.');
  });

  it('devuelve el valor tal cual si no se puede interpretar', () => {
    expect(formatFecha('mañana')).toBe('mañana');
    expect(formatHora('tarde')).toBe('tarde');
  });
});
