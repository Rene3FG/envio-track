import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import { AuthUserPayload } from '../types/express';

export const authenticateJwt = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthenticated('Falta el encabezado de autorización o formato inválido');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUserPayload;
    req.user = {
      id: payload.id,
      email: payload.email,
      rol: payload.rol,
    };
    next();
  } catch (_err) {
    throw AppError.unauthenticated('Token inválido o expirado');
  }
};

export const requireRole = (...allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw AppError.unauthenticated();
    }

    if (!allowedRoles.includes(req.user.rol)) {
      throw AppError.forbidden('No cuentas con permisos suficientes para este recurso');
    }

    next();
  };
};
