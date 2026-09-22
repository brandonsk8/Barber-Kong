// Factory: recibe el repositorio como dependencia (mismo patrón que servicios.service.js)
// para poder testear la lógica de negocio con un repositorio falso, sin tocar Postgres.
import { randomUUID, randomInt, createHash } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ApiError } from '../../helpers/ApiError.js';
import { notify } from '../../services/notification.service.js';
import { barberosService } from '../barberos/barberos.instance.js';

const SALT_ROUNDS = 10;
const TWO_FACTOR_TTL_MINUTES = 10;
const RESET_TOKEN_TTL_HOURS = 1;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

// citas.service.js espera barbero_id = barberos.id (no users.id) para la agenda del
// barbero, así que el perfil que ve el frontend lo trae ya resuelto — evita que cada
// pantalla de barbero tenga que hacer una consulta aparte para conocer su propio id.
async function publicUser(user) {
  const base = { id: user.id, email: user.email, role: user.role, twoFactorEnabled: user.two_factor_enabled };
  if (user.role === 'barbero') {
    const barbero = await barberosService.getByUserId(user.id);
    if (barbero) base.barberoId = barbero.id;
  }
  return base;
}

function issueToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
  );
}

export function createAuthService({ repository }) {
  return {
    async register({ email, password, nombre, telefono }) {
      const existing = await repository.findUserByEmail(email);
      if (existing) throw ApiError.conflict('Ya existe una cuenta con ese correo.');

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await repository.createUser({ email, passwordHash, role: 'cliente' });
      await repository.createCliente({ userId: user.id, nombre, telefono, correo: email });

      return await publicUser(user);
    },

    async login({ email, password }) {
      const user = await repository.findUserByEmail(email);
      if (!user || !user.is_active) throw ApiError.unauthorized('Correo o contraseña incorrectos.');

      const matches = await bcrypt.compare(password, user.password_hash);
      if (!matches) throw ApiError.unauthorized('Correo o contraseña incorrectos.');

      if (user.two_factor_enabled) {
        await repository.invalidatePendingTwoFactorCodes(user.id);
        const code = String(randomInt(0, 1000000)).padStart(6, '0');
        const expiresAt = new Date(Date.now() + TWO_FACTOR_TTL_MINUTES * 60 * 1000);
        await repository.createTwoFactorCode({ userId: user.id, codeHash: sha256(code), expiresAt });

        await notify({
          userId: user.id,
          email: user.email,
          tipo: 'dos_factor',
          titulo: 'Tu código de verificación — Barber Kong',
          mensaje: `Tu código de verificación es ${code}. Vence en ${TWO_FACTOR_TTL_MINUTES} minutos.`,
        });

        return { requiresTwoFactor: true, userId: user.id };
      }

      return { requiresTwoFactor: false, token: issueToken(user), user: await publicUser(user) };
    },

    async verifyTwoFactor({ userId, code }) {
      const user = await repository.findUserById(userId);
      if (!user) throw ApiError.unauthorized('No se pudo verificar el código.');

      const record = await repository.findValidTwoFactorCode(userId, sha256(code));
      if (!record) throw ApiError.unauthorized('El código es incorrecto o ya expiró.');

      await repository.markTwoFactorCodeUsed(record.id);
      return { token: issueToken(user), user: await publicUser(user) };
    },

    async forgotPassword(email) {
      const user = await repository.findUserByEmail(email);
      // No revelamos si el correo existe o no (evita enumeración de cuentas).
      if (user) {
        const token = randomUUID() + randomUUID();
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000);
        await repository.createPasswordResetToken({
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt,
        });

        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/restablecer?token=${token}`;
        await notify({
          userId: user.id,
          email: user.email,
          tipo: 'recuperacion_password',
          titulo: 'Recuperar contraseña — Barber Kong',
          mensaje: `Hacé clic en este enlace para restablecer tu contraseña (vence en ${RESET_TOKEN_TTL_HOURS} hora): ${resetUrl}`,
        });
      }

      return { message: 'Si el correo existe, te enviamos un enlace para restablecer tu contraseña.' };
    },

    async resetPassword({ token, password }) {
      const record = await repository.findValidPasswordResetToken(sha256(token));
      if (!record) throw ApiError.badRequest('El enlace no es válido o ya expiró.');

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      await repository.updatePasswordHash(record.user_id, passwordHash);
      await repository.markPasswordResetTokenUsed(record.id);

      return { message: 'Contraseña actualizada. Ya podés ingresar con tu nueva contraseña.' };
    },

    async me(userId) {
      const user = await repository.findUserById(userId);
      if (!user) throw ApiError.notFound('Usuario no encontrado.');
      return await publicUser(user);
    },

    // RF-AUT-07: 2FA es opcional, lo habilita cada usuario para su propia cuenta.
    // Pide la contraseña actual para confirmar — es un cambio de seguridad, no un
    // dato de perfil cualquiera, así que no basta con estar logueado.
    async updateTwoFactor(userId, { enabled, password }) {
      const user = await repository.findUserById(userId);
      if (!user) throw ApiError.notFound('Usuario no encontrado.');

      const matches = await bcrypt.compare(password, user.password_hash);
      if (!matches) throw ApiError.unauthorized('Contraseña incorrecta.');

      const updated = await repository.setTwoFactorEnabled(userId, enabled);
      return await publicUser(updated);
    },
  };
}
