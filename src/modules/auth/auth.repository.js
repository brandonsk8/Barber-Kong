// Único lugar con acceso a datos de este módulo. SQL parametrizado a mano, sin ORM
// (mismo patrón que src/modules/servicios/servicios.repository.js).
import { randomUUID } from 'node:crypto';
import { query } from '../../config/db.js';

export async function findUserByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

export async function findUserById(id) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function createUser({ email, passwordHash, role, twoFactorEnabled = false }) {
  const id = randomUUID();
  const { rows } = await query(
    `INSERT INTO users (id, email, password_hash, role, two_factor_enabled)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, email, passwordHash, role, twoFactorEnabled]
  );
  return rows[0];
}

export async function updatePasswordHash(userId, passwordHash) {
  await query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [
    userId,
    passwordHash,
  ]);
}

export async function setTwoFactorEnabled(userId, enabled) {
  const { rows } = await query(
    `UPDATE users SET two_factor_enabled = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [userId, enabled]
  );
  return rows[0] || null;
}

export async function createCliente({ userId, nombre, telefono, correo }) {
  const id = randomUUID();
  const { rows } = await query(
    `INSERT INTO clientes (id, user_id, nombre, telefono, correo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, userId, nombre, telefono || null, correo || null]
  );
  return rows[0];
}

// --- Códigos de verificación en dos pasos (2FA) -----------------------------------
export async function invalidatePendingTwoFactorCodes(userId) {
  await query(`UPDATE two_factor_codes SET used = TRUE WHERE user_id = $1 AND used = FALSE`, [userId]);
}

export async function createTwoFactorCode({ userId, codeHash, expiresAt }) {
  const id = randomUUID();
  await query(
    `INSERT INTO two_factor_codes (id, user_id, code_hash, expires_at) VALUES ($1, $2, $3, $4)`,
    [id, userId, codeHash, expiresAt]
  );
  return id;
}

export async function findValidTwoFactorCode(userId, codeHash) {
  const { rows } = await query(
    `SELECT * FROM two_factor_codes
     WHERE user_id = $1 AND code_hash = $2 AND used = FALSE AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [userId, codeHash]
  );
  return rows[0] || null;
}

export async function markTwoFactorCodeUsed(id) {
  await query(`UPDATE two_factor_codes SET used = TRUE WHERE id = $1`, [id]);
}

// --- Tokens de recuperación de contraseña -----------------------------------------
export async function createPasswordResetToken({ userId, tokenHash, expiresAt }) {
  const id = randomUUID();
  await query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
    [id, userId, tokenHash, expiresAt]
  );
  return id;
}

export async function findValidPasswordResetToken(tokenHash) {
  const { rows } = await query(
    `SELECT * FROM password_reset_tokens
     WHERE token_hash = $1 AND used = FALSE AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
}

export async function markPasswordResetTokenUsed(id) {
  await query(`UPDATE password_reset_tokens SET used = TRUE WHERE id = $1`, [id]);
}
