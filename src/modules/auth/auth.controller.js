import * as repository from './auth.repository.js';
import { createAuthService } from './auth.service.js';
import {
  registerSchema,
  loginSchema,
  verifyTwoFactorSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema.js';
import { validate } from '../../helpers/validate.js';

// Composition root del módulo: aquí se arma el service con su repositorio real.
const service = createAuthService({ repository });

export async function register(req, res, next) {
  try {
    const data = validate(registerSchema, req.body);
    const user = await service.register(data);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const data = validate(loginSchema, req.body);
    const result = await service.login(data);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function verifyTwoFactor(req, res, next) {
  try {
    const data = validate(verifyTwoFactorSchema, req.body);
    const result = await service.verifyTwoFactor(data);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { email } = validate(forgotPasswordSchema, req.body);
    const result = await service.forgotPassword(email);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const data = validate(resetPasswordSchema, req.body);
    const result = await service.resetPassword(data);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await service.me(req.user.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
