import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './config/env';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { packagesRouter } from './modules/packages/packages.routes';
import { errorHandler } from './middlewares/error-handler';
import { AppError } from './errors/app-error';

export const createApp = (): Express => {
  const app = express();

  // Middlewares globales
  app.use(cors());
  app.use(express.json());

  // Servir archivos estáticos de /uploads
  const uploadPath = path.resolve(process.cwd(), env.UPLOAD_DIR);
  app.use('/uploads', express.static(uploadPath));

  // Rutas de la API
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/packages', packagesRouter);

  // Manejo de rutas inexistentes (404)
  app.use('*', (_req, _res, next) => {
    next(AppError.notFound('Ruta no encontrada'));
  });

  // Manejador global de errores
  app.use(errorHandler);

  return app;
};
