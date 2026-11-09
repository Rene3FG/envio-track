import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../errors/app-error';

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        next(new AppError(400, 'VALIDATION_ERROR', 'Error de validación en la petición', details));
      } else {
        next(err);
      }
    }
  };
};

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as Record<string, string>;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        next(new AppError(400, 'VALIDATION_ERROR', 'Parámetros de consulta inválidos', details));
      } else {
        next(err);
      }
    }
  };
};
