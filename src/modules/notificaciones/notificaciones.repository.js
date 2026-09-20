// Único lugar con acceso a datos de este módulo. No inserta nada -- eso ya lo hace
// src/services/notification.service.js#notify desde cada módulo que dispara un evento.
import { query } from '../../config/db.js';

export async function findByUserId(userId) {
  const { rows } = await query(
    `SELECT * FROM notificaciones WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

export async function findById(id) {
  const { rows } = await query('SELECT * FROM notificaciones WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function markAsRead(id) {
  const { rows } = await query(
    `UPDATE notificaciones SET leida = TRUE WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}
