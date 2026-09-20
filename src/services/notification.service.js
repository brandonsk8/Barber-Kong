// Plomería compartida: cada módulo (Auth, Citas, Inventario) llama a `notify` con el
// tipo de evento correspondiente. Se encarga de dos cosas a la vez:
// 1) enviar el correo (requisito mínimo del sistema, RF-AUT-07/RF-CIT-08/RF-INV-04), y
// 2) dejar el registro en `notificaciones` para que el usuario lo consulte luego (UC-26).
// El contenido exacto (asunto/cuerpo) de cada tipo lo define el dueño de esa épica; esto
// es solo la mecánica común, sin ORM: un INSERT parametrizado + el envío de correo.
import { randomUUID } from 'node:crypto';
import { query } from '../config/db.js';
import { sendMail } from './mailer.js';

export async function notify({ userId, email, tipo, titulo, mensaje }) {
  await query(
    `INSERT INTO notificaciones (id, user_id, tipo, titulo, mensaje) VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), userId, tipo, titulo, mensaje]
  );

  if (email) {
    await sendMail({ to: email, subject: titulo, html: `<p>${mensaje}</p>` });
  }
}
