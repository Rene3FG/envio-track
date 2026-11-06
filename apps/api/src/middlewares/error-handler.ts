import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../errors/app-error';

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && err.details.length > 0 ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Error inesperado: loggear en consola y devolver respuesta genérica segura
  console.error('[UNHANDLED_ERROR]:', err);

  res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: 'Ocurrió un error interno en el servidor',
    },
  });
};
