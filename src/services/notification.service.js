// Plomería compartida: cada módulo (Auth, Citas, Inventario) llama a `notify` con el
// tipo de evento correspondiente. Se encarga de dos cosas a la vez:
// 1) enviar el correo (requisito mínimo del sistema, RF-AUT-07/RF-CIT-08/RF-INV-04), y
// 2) dejar el registro en `notificaciones` para que el usuario lo consulte luego (UC-26).
// El contenido exacto (asunto/cuerpo) de cada tipo lo define el dueño de esa épica; esto
// es solo la mecánica común, sin ORM: un INSERT parametrizado + el envío de correo.
import { randomUUID } from 'node:crypto';
import { query } from '../config/db.js';
import { sendMail } from './mailer.js';
import { logger } from '../config/logger.js';

export async function notify({ userId, email, tipo, titulo, mensaje }) {
  await query(
    `INSERT INTO notificaciones (id, user_id, tipo, titulo, mensaje) VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), userId, tipo, titulo, mensaje]
  );

  if (email) {
    // El envío de correo nunca debe tumbar el flujo principal (login, agendar cita,
    // etc.): si el SMTP no está configurado o falla, el usuario igual completa su
    // acción y ve la notificación dentro del sistema (tabla `notificaciones`, UC-26).
    try {
      await sendMail({ to: email, subject: titulo, html: `<p>${mensaje}</p>` });
    } catch (err) {
      logger.warn('No se pudo enviar el correo de notificación.', { tipo, email, error: err.message });
    }
  }
}
