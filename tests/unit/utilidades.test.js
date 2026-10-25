import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/config/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), http: vi.fn(), debug: vi.fn() },
}));

import { ApiError } from '../../src/helpers/ApiError.js';
import { errorHandler } from '../../src/helpers/errorHandler.js';
import { requireAuth, requireRole } from '../../src/middlewares/auth.middleware.js';

function fakeRes() {
  const res = { statusCode: null, body: null };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('ApiError', () => {
  it('cada atajo trae su código HTTP', () => {
    expect(ApiError.badRequest('x').status).toBe(400);
    expect(ApiError.unauthorized().status).toBe(401);
    expect(ApiError.forbidden().status).toBe(403);
    expect(ApiError.notFound().status).toBe(404);
    expect(ApiError.conflict('x').status).toBe(409);
    expect(ApiError.badRequest('x')).toBeInstanceOf(Error);
  });
});

describe('errorHandler', () => {
  it('muestra al usuario el mensaje de los errores 4xx', () => {
    const res = fakeRes();
    errorHandler(ApiError.conflict('Ese día ya está marcado.'), { path: '/x', method: 'POST' }, res, vi.fn());

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ message: 'Ese día ya está marcado.' });
  });

  it('en un 500 nunca filtra el detalle interno', () => {
    const res = fakeRes();
    errorHandler(new Error('relation "secreta" does not exist'), { path: '/x', method: 'GET' }, res, vi.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: 'Ocurrió un error inesperado.' });
    expect(JSON.stringify(res.body)).not.toContain('secreta');
  });
});

describe('middleware de autenticación', () => {
  const token = (payload, opts) => jwt.sign(payload, process.env.JWT_SECRET, opts);
  const llamar = (headers) => {
    const req = { headers };
    const next = vi.fn();
    requireAuth(req, fakeRes(), next);
    return { req, error: next.mock.calls[0]?.[0] };
  };

  it('sin encabezado, con esquema distinto de Bearer o con token basura responde 401', () => {
    expect(llamar({}).error).toMatchObject({ status: 401 });
    expect(llamar({ authorization: 'Basic abc' }).error).toMatchObject({ status: 401 });
    expect(llamar({ authorization: 'Bearer no-es-un-jwt' }).error).toMatchObject({ status: 401 });
  });

  it('rechaza un token firmado con otro secreto o ya vencido', () => {
    const ajeno = jwt.sign({ id: 'u', role: 'admin' }, 'otro-secreto');
    const vencido = token({ id: 'u', role: 'admin' }, { expiresIn: -10 });

    expect(llamar({ authorization: `Bearer ${ajeno}` }).error).toMatchObject({ status: 401 });
    expect(llamar({ authorization: `Bearer ${vencido}` }).error).toMatchObject({ status: 401 });
  });

  it('con un token válido deja pasar y expone el usuario en req.user', () => {
    const { req, error } = llamar({ authorization: `Bearer ${token({ id: 'u-1', email: 'a@x.com', role: 'barbero' })}` });

    expect(error).toBeUndefined();
    expect(req.user).toMatchObject({ id: 'u-1', role: 'barbero' });
  });

  it('requireRole: permite los roles de la lista, da 403 a otros y 401 si no hay sesión', () => {
    const correr = (user) => {
      const next = vi.fn();
      requireRole('admin', 'barbero')({ user }, fakeRes(), next);
      return next.mock.calls[0]?.[0];
    };

    expect(correr({ role: 'admin' })).toBeUndefined();
    expect(correr({ role: 'barbero' })).toBeUndefined();
    expect(correr({ role: 'cliente' })).toMatchObject({ status: 403 });
    expect(correr(undefined)).toMatchObject({ status: 401 });
  });
});
