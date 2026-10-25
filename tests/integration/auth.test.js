import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { sendMail } from '../../src/services/mailer.js';
import { query } from '../../src/config/db.js';
import { getApp, crearUsuario, login, unico, cerrar, PASSWORD } from '../helpers/fixtures.js';

let api;

beforeAll(async () => {
  api = request(await getApp());
});
afterAll(cerrar);

describe('registro e inicio de sesión (HTTP + BD real)', () => {
  const nombre = unico('registro');
  const email = `${nombre}@test.local`;

  it('registra un cliente, no expone el hash y deja su perfil de cliente creado', async () => {
    const res = await api.post('/api/auth/register').send({ nombre, email, password: PASSWORD, telefono: '5555-1234' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email, role: 'cliente' });
    expect(JSON.stringify(res.body)).not.toContain('password');

    const { rows } = await query('SELECT c.nombre FROM clientes c JOIN users u ON u.id = c.user_id WHERE u.email = $1', [email]);
    expect(rows).toHaveLength(1);
    const guardado = (await query('SELECT password_hash FROM users WHERE email = $1', [email])).rows[0].password_hash;
    expect(guardado).not.toBe(PASSWORD);
  });

  it('el mismo correo no se puede registrar dos veces (409) y los datos inválidos dan 400 en español', async () => {
    expect((await api.post('/api/auth/register').send({ nombre, email, password: PASSWORD })).status).toBe(409);

    const corta = await api.post('/api/auth/register').send({ nombre: 'X', email: 'nuevo@test.local', password: '123' });
    expect(corta.status).toBe(400);
    expect(corta.body.message).toBeTruthy();
  });

  it('login correcto entrega token y perfil; /me lo reconoce; sin token o con token falso es 401', async () => {
    const res = await api.post('/api/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();

    const me = await api.get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user?.email ?? me.body.email).toBe(email);

    expect((await api.get('/api/auth/me')).status).toBe(401);
    expect((await api.get('/api/auth/me').set('Authorization', 'Bearer falso')).status).toBe(401);
  });

  it('contraseña incorrecta y correo inexistente dan el mismo 401', async () => {
    const mala = await api.post('/api/auth/login').send({ email, password: 'otra-clave-mala' });
    const fantasma = await api.post('/api/auth/login').send({ email: 'nadie@test.local', password: PASSWORD });

    expect([mala.status, fantasma.status]).toEqual([401, 401]);
    expect(mala.body.message).toBe(fantasma.body.message);
  });

  it('una cuenta desactivada no entra aunque la contraseña sea correcta', async () => {
    const u = await crearUsuario({ role: 'cliente' });
    await query('UPDATE users SET is_active = FALSE WHERE id = $1', [u.id]);

    expect((await api.post('/api/auth/login').send({ email: u.email, password: u.password })).status).toBe(401);
  });
});

describe('segundo factor (2FA)', () => {
  it('con 2FA activo el login no da token: manda un código al correo y solo con ese código se entra', async () => {
    const u = await crearUsuario({ role: 'cliente', twoFactor: true });
    vi.mocked(sendMail).mockClear();

    const paso1 = await api.post('/api/auth/login').send({ email: u.email, password: u.password });
    expect(paso1.status).toBe(200);
    expect(paso1.body).toMatchObject({ requiresTwoFactor: true, userId: u.id });
    expect(paso1.body.token).toBeUndefined();

    const correo = vi.mocked(sendMail).mock.calls.find(([m]) => m.to === u.email)[0];
    const codigo = correo.text.match(/\b\d{6}\b/)[0];

    expect((await api.post('/api/auth/verify-2fa').send({ userId: u.id, code: '000000' })).status).toBe(401);

    const ok = await api.post('/api/auth/verify-2fa').send({ userId: u.id, code: codigo });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();

    // El código es de un solo uso.
    expect((await api.post('/api/auth/verify-2fa').send({ userId: u.id, code: codigo })).status).toBe(401);
    // Y en la BD solo está su hash.
    const { rows } = await query('SELECT code_hash FROM two_factor_codes WHERE user_id = $1', [u.id]);
    expect(rows[0].code_hash).toBe(createHash('sha256').update(codigo).digest('hex'));
  });
});

describe('recuperar contraseña', () => {
  it('manda el enlace, permite cambiar la contraseña una vez y la anterior deja de servir', async () => {
    const u = await crearUsuario({ role: 'cliente' });
    vi.mocked(sendMail).mockClear();

    expect((await api.post('/api/auth/forgot-password').send({ email: u.email })).status).toBe(200);
    const correo = vi.mocked(sendMail).mock.calls.find(([m]) => m.to === u.email)[0];
    const token = new URL(correo.text.match(/https?:\/\/\S+/)[0]).searchParams.get('token');

    const nueva = 'NuevaClave456!';
    expect((await api.post('/api/auth/reset-password').send({ token, password: nueva })).status).toBe(200);

    expect((await api.post('/api/auth/login').send({ email: u.email, password: nueva })).status).toBe(200);
    expect((await api.post('/api/auth/login').send({ email: u.email, password: u.password })).status).toBe(401);
    // El enlace no se puede reutilizar.
    expect((await api.post('/api/auth/reset-password').send({ token, password: 'OtraClave789!' })).status).toBe(400);
  });

  it('con un correo que no existe responde igual y no manda ningún correo', async () => {
    vi.mocked(sendMail).mockClear();
    const res = await api.post('/api/auth/forgot-password').send({ email: 'no-existe@test.local' });

    expect(res.status).toBe(200);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('autorización por rol en el backend', () => {
  it('un cliente no puede usar endpoints de administración', async () => {
    const cliente = await login(await crearUsuario({ role: 'cliente' }));

    for (const [metodo, ruta] of [
      ['get', '/api/inventario'],
      ['get', '/api/reportes?tipo=citas&formato=pdf&desde=2026-01-01&hasta=2026-01-31'],
      ['get', '/api/barberos/admin'],
      ['post', '/api/servicios'],
    ]) {
      const res = await api[metodo](ruta).set(cliente).send({});
      expect(res.status, `${metodo.toUpperCase()} ${ruta}`).toBe(403);
    }
  });

  it('sin sesión esas mismas rutas responden 401', async () => {
    for (const ruta of ['/api/inventario', '/api/barberos/admin', '/api/citas', '/api/notificaciones']) {
      expect((await api.get(ruta)).status, ruta).toBe(401);
    }
  });

  it('un barbero tampoco administra inventario ni reportes', async () => {
    const barbero = await login(await crearUsuario({ role: 'barbero' }));

    expect((await api.get('/api/inventario').set(barbero)).status).toBe(403);
    expect((await api.get('/api/reportes?tipo=citas&formato=pdf&desde=2026-01-01&hasta=2026-01-31').set(barbero)).status).toBe(403);
  });
});
