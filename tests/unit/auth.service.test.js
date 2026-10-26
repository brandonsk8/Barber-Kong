import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const mocks = vi.hoisted(() => ({ notify: vi.fn(), getByUserId: vi.fn() }));

vi.mock('../../src/services/notification.service.js', () => ({ notify: mocks.notify }));
vi.mock('../../src/modules/barberos/barberos.instance.js', () => ({
  barberosService: { getByUserId: mocks.getByUserId },
}));

import { createAuthService } from '../../src/modules/auth/auth.service.js';

const sha256 = (v) => createHash('sha256').update(v).digest('hex');
const PASSWORD = 'Prueba123!';
let HASH;

function usuario(over = {}) {
  return { id: 'u-1', email: 'ana@x.com', role: 'cliente', is_active: true, two_factor_enabled: false, password_hash: HASH, ...over };
}

function fakeRepository(overrides = {}) {
  return {
    findUserByEmail: vi.fn().mockResolvedValue(null),
    findUserById: vi.fn().mockResolvedValue(usuario()),
    createUser: vi.fn(async (u) => usuario({ email: u.email, role: u.role, password_hash: u.passwordHash })),
    createCliente: vi.fn().mockResolvedValue({}),
    invalidatePendingTwoFactorCodes: vi.fn().mockResolvedValue(undefined),
    createTwoFactorCode: vi.fn().mockResolvedValue(undefined),
    findValidTwoFactorCode: vi.fn().mockResolvedValue(null),
    markTwoFactorCodeUsed: vi.fn().mockResolvedValue(undefined),
    createPasswordResetToken: vi.fn().mockResolvedValue(undefined),
    findValidPasswordResetToken: vi.fn().mockResolvedValue(null),
    updatePasswordHash: vi.fn().mockResolvedValue(undefined),
    markPasswordResetTokenUsed: vi.fn().mockResolvedValue(undefined),
    setTwoFactorEnabled: vi.fn(async (id, enabled) => usuario({ id, two_factor_enabled: enabled })),
    ...overrides,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.notify.mockResolvedValue(undefined);
  mocks.getByUserId.mockResolvedValue(null);
  HASH ||= await bcrypt.hash(PASSWORD, 4); // costo bajo: solo para que las pruebas sean rápidas
});

describe('auth.service — registro', () => {
  it('crea una cuenta con rol cliente y guarda la contraseña con hash, no en claro', async () => {
    const repository = fakeRepository();
    await createAuthService({ repository }).register({ email: 'nueva@x.com', password: PASSWORD, nombre: 'Nueva', telefono: '5555' });

    const { passwordHash, role } = repository.createUser.mock.calls[0][0];
    expect(role).toBe('cliente');
    expect(passwordHash).not.toBe(PASSWORD);
    expect(await bcrypt.compare(PASSWORD, passwordHash)).toBe(true);
    expect(repository.createCliente).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Nueva', correo: 'nueva@x.com' }));
  });

  it('un correo ya registrado devuelve 409', async () => {
    const repository = fakeRepository({ findUserByEmail: vi.fn().mockResolvedValue(usuario()) });
    await expect(createAuthService({ repository }).register({ email: 'ana@x.com', password: PASSWORD, nombre: 'A' })).rejects.toMatchObject({ status: 409 });
  });
});

describe('auth.service — login', () => {
  it('no distingue entre correo inexistente y contraseña incorrecta (mismo 401 y mismo mensaje)', async () => {
    const sinUsuario = createAuthService({ repository: fakeRepository() });
    const claveMala = createAuthService({ repository: fakeRepository({ findUserByEmail: vi.fn().mockResolvedValue(usuario()) }) });

    const a = await sinUsuario.login({ email: 'no@x.com', password: PASSWORD }).catch((e) => e);
    const b = await claveMala.login({ email: 'ana@x.com', password: 'otra-clave' }).catch((e) => e);

    expect([a.status, b.status]).toEqual([401, 401]);
    expect(a.message).toBe(b.message);
  });

  it('una cuenta desactivada no puede entrar', async () => {
    const repository = fakeRepository({ findUserByEmail: vi.fn().mockResolvedValue(usuario({ is_active: false })) });
    await expect(createAuthService({ repository }).login({ email: 'ana@x.com', password: PASSWORD })).rejects.toMatchObject({ status: 401 });
  });

  it('sin 2FA devuelve un JWT firmado con id, correo y rol', async () => {
    const repository = fakeRepository({ findUserByEmail: vi.fn().mockResolvedValue(usuario({ role: 'admin' })) });
    const res = await createAuthService({ repository }).login({ email: 'ana@x.com', password: PASSWORD });

    expect(res.requiresTwoFactor).toBe(false);
    expect(jwt.verify(res.token, process.env.JWT_SECRET)).toMatchObject({ id: 'u-1', email: 'ana@x.com', role: 'admin' });
  });

  it('con 2FA no entrega token: guarda el código con hash y lo manda por correo', async () => {
    const repository = fakeRepository({ findUserByEmail: vi.fn().mockResolvedValue(usuario({ two_factor_enabled: true })) });
    const res = await createAuthService({ repository }).login({ email: 'ana@x.com', password: PASSWORD });

    expect(res).toEqual({ requiresTwoFactor: true, userId: 'u-1' });
    expect(res.token).toBeUndefined();

    const { codigo } = mocks.notify.mock.calls[0][0].datos;
    expect(codigo).toMatch(/^\d{6}$/);
    const guardado = repository.createTwoFactorCode.mock.calls[0][0];
    expect(guardado.codeHash).toBe(sha256(codigo));
    expect(guardado.codeHash).not.toContain(codigo);
    expect(guardado.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(repository.invalidatePendingTwoFactorCodes).toHaveBeenCalledWith('u-1');
  });

  it('un barbero recibe además su barberoId en el perfil (distinto del id de usuario)', async () => {
    mocks.getByUserId.mockResolvedValue({ id: 'b-9' });
    const repository = fakeRepository({ findUserByEmail: vi.fn().mockResolvedValue(usuario({ role: 'barbero' })) });

    const res = await createAuthService({ repository }).login({ email: 'ana@x.com', password: PASSWORD });
    expect(res.user.barberoId).toBe('b-9');
  });
});

describe('auth.service — segundo factor', () => {
  it('un código incorrecto o vencido devuelve 401', async () => {
    const service = createAuthService({ repository: fakeRepository() });
    await expect(service.verifyTwoFactor({ userId: 'u-1', code: '000000' })).rejects.toMatchObject({ status: 401 });
  });

  it('un código válido entrega el token y queda marcado como usado', async () => {
    const repository = fakeRepository({ findValidTwoFactorCode: vi.fn().mockResolvedValue({ id: 'c-1' }) });
    const res = await createAuthService({ repository }).verifyTwoFactor({ userId: 'u-1', code: '123456' });

    expect(repository.findValidTwoFactorCode).toHaveBeenCalledWith('u-1', sha256('123456'));
    expect(repository.markTwoFactorCodeUsed).toHaveBeenCalledWith('c-1');
    expect(jwt.verify(res.token, process.env.JWT_SECRET).id).toBe('u-1');
  });

  it('activar o desactivar el 2FA exige la contraseña actual', async () => {
    const repository = fakeRepository();
    const service = createAuthService({ repository });

    await expect(service.updateTwoFactor('u-1', { enabled: true, password: 'incorrecta' })).rejects.toMatchObject({ status: 401 });
    expect(repository.setTwoFactorEnabled).not.toHaveBeenCalled();

    const res = await service.updateTwoFactor('u-1', { enabled: true, password: PASSWORD });
    expect(res.twoFactorEnabled).toBe(true);
  });
});

describe('auth.service — recuperar contraseña', () => {
  it('responde igual exista o no el correo y, si no existe, no manda nada', async () => {
    const existente = fakeRepository({ findUserByEmail: vi.fn().mockResolvedValue(usuario()) });

    const a = await createAuthService({ repository: fakeRepository() }).forgotPassword('no@x.com');
    expect(mocks.notify).not.toHaveBeenCalled();

    const b = await createAuthService({ repository: existente }).forgotPassword('ana@x.com');
    expect(a).toEqual(b);
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });

  it('el enlace lleva un token cuyo hash es lo único que se guarda', async () => {
    const repository = fakeRepository({ findUserByEmail: vi.fn().mockResolvedValue(usuario()) });
    await createAuthService({ repository }).forgotPassword('ana@x.com');

    const { datos } = mocks.notify.mock.calls[0][0];
    const token = new URL(datos.accion.url).searchParams.get('token');
    expect(token).toBeTruthy();
    expect(repository.createPasswordResetToken.mock.calls[0][0].tokenHash).toBe(sha256(token));
  });

  it('un token inválido devuelve 400; uno válido cambia la contraseña y se marca como usado', async () => {
    await expect(createAuthService({ repository: fakeRepository() }).resetPassword({ token: 'malo', password: 'NuevaClave1!' })).rejects.toMatchObject({ status: 400 });

    const repository = fakeRepository({ findValidPasswordResetToken: vi.fn().mockResolvedValue({ id: 't-1', user_id: 'u-1' }) });
    await createAuthService({ repository }).resetPassword({ token: 'bueno', password: 'NuevaClave1!' });

    expect(repository.findValidPasswordResetToken).toHaveBeenCalledWith(sha256('bueno'));
    const [userId, nuevoHash] = repository.updatePasswordHash.mock.calls[0];
    expect(userId).toBe('u-1');
    expect(await bcrypt.compare('NuevaClave1!', nuevoHash)).toBe(true);
    expect(repository.markPasswordResetTokenUsed).toHaveBeenCalledWith('t-1');
  });
});
