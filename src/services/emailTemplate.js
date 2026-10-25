// Plantilla de correo compartida: toda notificación por correo sale con la misma marca
// de Barber Kongs y un cuerpo pensado para entenderse de un vistazo (título claro, el dato
// importante resaltado -código, botón o detalle de la cita- y una línea de qué hacer).
// HTML "email-safe": tablas y estilos en línea, sin CSS externo ni imágenes, para que se
// vea igual en Gmail, Outlook y el celular. Todo valor dinámico pasa por `esc()`.

const COLORES = {
  fondo: '#f4f1ec',
  tarjeta: '#ffffff',
  oscuro: '#1a1612',
  dorado: '#c9a15b',
  doradoSuave: '#faf6ee',
  texto: '#2b2622',
  atenuado: '#7a7068',
  borde: '#e7e0d4',
  alerta: '#b4532a',
};

// Por tipo de evento: encabezado, a quién va dirigido el color de acento y la ayuda final.
const TIPOS = {
  dos_factor: {
    encabezado: 'Tu código de verificación',
    intro: 'Usa este código para terminar de iniciar sesión:',
    ayuda: 'Si no intentaste iniciar sesión, ignora este correo y cambia tu contraseña por seguridad.',
  },
  recuperacion_password: {
    encabezado: 'Restablece tu contraseña',
    intro: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta. Presiona el botón para elegir una nueva:',
    ayuda: 'Si no pediste este cambio, ignora este correo: tu contraseña actual sigue funcionando.',
  },
  confirmacion_cita: {
    encabezado: '¡Tu cita está confirmada!',
    intro: 'Te esperamos en Barber Kongs. Estos son los datos de tu cita:',
    ayuda: '¿Necesitas cambiarla? Entra a tu cuenta y reprograma o cancela desde "Mis citas".',
  },
  reprogramacion_cita: {
    encabezado: 'Tu cita fue reprogramada',
    intro: 'Hicimos el cambio. Tu cita quedó así:',
    ayuda: '¿Te equivocaste de horario? Puedes reprogramarla de nuevo desde "Mis citas".',
  },
  cancelacion_cita: {
    encabezado: 'Tu cita fue cancelada',
    intro: 'Esta es la cita que se canceló:',
    ayuda: 'Cuando quieras, entra a tu cuenta y agenda una nueva. Atendemos de domingo a jueves.',
    acento: COLORES.alerta,
  },
  alerta_inventario: {
    encabezado: 'Stock bajo en inventario',
    intro: 'Un insumo cayó por debajo del mínimo configurado:',
    ayuda: 'Registra un reabastecimiento en Inventario para quitar la alerta.',
    acento: COLORES.alerta,
  },
};

const TIPO_GENERICO = { encabezado: null, intro: null, ayuda: null };

function esc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Solo enlaces http(s): evita que un valor raro termine como `javascript:` en un botón.
function urlSegura(url) {
  return /^https?:\/\//i.test(String(url ?? '')) ? String(url) : null;
}

// "2026-09-27" -> "domingo 27 de septiembre de 2026". Se arma en UTC a propósito: la
// fecha ya es solo-día, no debe correrse por la zona horaria del servidor.
export function formatFecha(fecha) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha ?? ''));
  if (!match) return String(fecha ?? '');
  const [, y, m, d] = match;
  const texto = new Intl.DateTimeFormat('es-GT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))));
  return texto;
}

// "10:00:00" o "10:00" -> "10:00 a. m." / "3:30 p. m." (12 horas, como en los mockups).
export function formatHora(hora) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(hora ?? ''));
  if (!match) return String(hora ?? '');
  const h = Number(match[1]);
  const sufijo = h >= 12 ? 'p. m.' : 'a. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${match[2]} ${sufijo}`;
}

function bloqueCodigo(codigo, vence, acento) {
  return `
    <tr><td align="center" style="padding:8px 0 4px;">
      <div style="display:inline-block;background:${COLORES.doradoSuave};border:2px dashed ${acento};border-radius:10px;padding:16px 28px;">
        <span style="font-family:'Courier New',monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:${COLORES.oscuro};">${esc(codigo)}</span>
      </div>
    </td></tr>
    ${vence ? `<tr><td align="center" style="padding:10px 0 0;font-size:13px;color:${COLORES.atenuado};">Vence en ${esc(vence)}.</td></tr>` : ''}`;
}

function bloqueBoton(accion, acento) {
  const url = urlSegura(accion?.url);
  if (!url) return '';
  return `
    <tr><td align="center" style="padding:8px 0 4px;">
      <a href="${esc(url)}" style="display:inline-block;background:${acento};color:${COLORES.oscuro};text-decoration:none;font-weight:700;font-size:16px;padding:14px 32px;border-radius:8px;">${esc(accion.texto || 'Continuar')}</a>
    </td></tr>
    <tr><td align="center" style="padding:14px 0 0;font-size:12px;color:${COLORES.atenuado};line-height:1.5;">
      ¿El botón no funciona? Copia y pega este enlace en tu navegador:<br>
      <span style="word-break:break-all;color:${COLORES.texto};">${esc(url)}</span>
    </td></tr>`;
}

function bloqueDetalles(detalles, acento) {
  if (!detalles?.length) return '';
  const filas = detalles
    .map(
      ([etiqueta, valor], i) => `
        <tr>
          <td style="padding:10px 14px;font-size:13px;color:${COLORES.atenuado};width:38%;${i ? `border-top:1px solid ${COLORES.borde};` : ''}">${esc(etiqueta)}</td>
          <td style="padding:10px 14px;font-size:15px;font-weight:600;color:${COLORES.texto};${i ? `border-top:1px solid ${COLORES.borde};` : ''}">${esc(valor)}</td>
        </tr>`
    )
    .join('');
  return `
    <tr><td style="padding:6px 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLORES.borde};border-left:4px solid ${acento};border-radius:8px;background:${COLORES.doradoSuave};">
        ${filas}
      </table>
    </td></tr>`;
}

// `datos` (todo opcional):
//   codigo   -> string, se muestra grande (2FA)
//   vence    -> "10 minutos", acompaña al código
//   accion   -> { texto, url }, botón principal
//   textos   -> { encabezado, intro, ayuda } para reemplazar los textos del tipo de evento
//   nota     -> línea corta y discreta bajo el botón/código (p. ej. "El enlace vence en 1 hora.")
//   cita     -> { servicio, barbero, fecha, hora }, se arma la tarjeta con fecha/hora legibles
//   insumo   -> { nombre, disponible, unidad, minimo }, tarjeta de la alerta de stock
//   detalles -> [[etiqueta, valor], ...], tarjeta genérica para cualquier otro dato
// Si un módulo no manda `datos`, el correo sale igual con la marca y el `mensaje` tal cual.
function detallesDe(datos) {
  if (datos.detalles?.length) return datos.detalles;
  if (datos.cita) {
    const { cliente, servicio, barbero, fecha, hora } = datos.cita;
    // `cliente` solo lo manda el aviso al barbero; `barbero` solo el aviso al cliente.
    return [
      ...(cliente ? [['Cliente', cliente]] : []),
      ['Servicio', servicio],
      ...(barbero ? [['Barbero', barbero]] : []),
      ['Fecha', formatFecha(fecha)],
      ['Hora', formatHora(hora)],
    ];
  }
  if (datos.insumo) {
    const { nombre, disponible, unidad, minimo } = datos.insumo;
    const con = (n) => `${Number(n)} ${unidad || ''}`.trim();
    return [
      ['Insumo', nombre],
      ['Disponible', con(disponible)],
      ['Mínimo configurado', con(minimo)],
    ];
  }
  return [];
}

export function renderEmail({ tipo, titulo, mensaje, datos = {} }) {
  const detalles = detallesDe(datos);
  // `datos.textos` ({ encabezado, intro, ayuda }) permite que un mismo tipo de evento diga
  // otra cosa según a quién va dirigido (p. ej. cita confirmada: al cliente vs. al barbero).
  const cfg = { ...TIPO_GENERICO, ...(TIPOS[tipo] || {}), ...(datos.textos || {}) };
  const acento = cfg.acento || COLORES.dorado;
  const encabezado = cfg.encabezado || titulo;
  const intro = cfg.intro || mensaje;

  const cuerpo = [
    datos.codigo ? bloqueCodigo(datos.codigo, datos.vence, acento) : '',
    bloqueBoton(datos.accion, acento),
    datos.nota
      ? `<tr><td align="center" style="padding:12px 0 0;font-size:13px;color:${COLORES.atenuado};">${esc(datos.nota)}</td></tr>`
      : '',
    bloqueDetalles(detalles, acento),
  ].join('');

  // Texto oculto que algunos clientes de correo muestran junto al asunto.
  const preheader = cfg.intro ? `${encabezado} — ${cfg.intro}` : encabezado;

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:${COLORES.fondo};font-family:Arial,Helvetica,sans-serif;color:${COLORES.texto};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORES.fondo};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td align="center" style="background:${COLORES.oscuro};border-radius:12px 12px 0 0;padding:22px 16px;">
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#f3ede2;">Barber<span style="color:${COLORES.dorado};">Kong</span></span>
        </td></tr>
        <tr><td style="background:${COLORES.tarjeta};padding:30px 28px;border:1px solid ${COLORES.borde};border-top:0;border-radius:0 0 12px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:22px;font-weight:700;color:${COLORES.oscuro};padding-bottom:10px;">${esc(encabezado)}</td></tr>
            <tr><td style="font-size:15px;line-height:1.55;color:${COLORES.texto};padding-bottom:16px;">${esc(intro)}</td></tr>
            ${cuerpo}
            ${cfg.ayuda ? `<tr><td style="padding-top:24px;font-size:13px;line-height:1.5;color:${COLORES.atenuado};border-top:1px solid ${COLORES.borde};">${esc(cfg.ayuda)}</td></tr>` : ''}
          </table>
        </td></tr>
        <tr><td align="center" style="padding:16px 8px;font-size:12px;color:${COLORES.atenuado};line-height:1.5;">
          Barber Kongs · Xela, Quetzaltenango<br>
          Este es un mensaje automático, por favor no respondas a este correo.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // Versión en texto plano: la usan los clientes sin HTML y mejora la entrega (menos spam).
  const lineas = [encabezado, '', intro];
  if (datos.codigo) lineas.push('', `Código: ${datos.codigo}`, ...(datos.vence ? [`Vence en ${datos.vence}.`] : []));
  const url = urlSegura(datos.accion?.url);
  if (url) lineas.push('', `${datos.accion.texto || 'Continuar'}: ${url}`);
  if (datos.nota) lineas.push(datos.nota);
  if (detalles.length) lineas.push('', ...detalles.map(([e, v]) => `${e}: ${v}`));
  if (cfg.ayuda) lineas.push('', cfg.ayuda);
  lineas.push('', '— Barber Kongs');

  return { html, text: lineas.join('\n') };
}
