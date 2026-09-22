// Transporte SMTP compartido por todos los módulos que envían correo (2FA, recuperación
// de contraseña, confirmaciones de cita, alertas de inventario). En desarrollo, usar
// credenciales de https://ethereal.email en .env.dev; en producción, Amazon SES (ver
// Arquitectura e Infraestructura Cloud de Fase 1).
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  // Sin esto, un SMTP inalcanzable (típico en dev sin credenciales de Ethereal, o en
  // una red restringida) cuelga la request para siempre en vez de fallar rápido —
  // notification.service.js ya atrapa el error, pero necesita que efectivamente ocurra.
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 5000,
});

export async function sendMail({ to, subject, html }) {
  return transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
}
