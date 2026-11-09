import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './config/env';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { createSyncRouter } from './modules/sync/sync.router';
import { createPrismaSyncStore } from './modules/sync/sync.prisma-store';
import { SyncRequestSchema } from '@envio/shared';
import { authenticateJwt, requireRole } from './middlewares/auth.middleware';
import { validateBody } from './middlewares/validate';
import { prisma } from './config/prisma';
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
  // Sincronización offline de la app del repartidor (P2). validateBody convierte el ZodError en 400.
  app.use(
    '/api/sync',
    authenticateJwt,
    requireRole('REPARTIDOR'),
    validateBody(SyncRequestSchema),
    createSyncRouter(createPrismaSyncStore(prisma)),
  );

  // Manejo de rutas inexistentes (404)
  app.use('*', (_req, _res, next) => {
    next(AppError.notFound('Ruta no encontrada'));
  });

  // Manejador global de errores
  app.use(errorHandler);

  return app;
};
