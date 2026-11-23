import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './config/env';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { packagesRouter } from './modules/packages/packages.routes';
import { uploadRouter } from './modules/upload/upload.routes';
import { trackingRouter } from './modules/tracking/tracking.routes';
import { statsRouter } from './modules/stats/stats.routes';
import { errorHandler } from './middlewares/error-handler';
import { AppError } from './errors/app-error';
import { prisma } from './config/prisma';

export const createApp = (): Express => {
  const app = express();

  // Middlewares globales
  app.use(cors());
  app.use(express.json());

  // Servir archivos estáticos de /uploads
  const uploadPath = path.resolve(process.cwd(), env.UPLOAD_DIR);
  app.use('/uploads', express.static(uploadPath));

  // Healthcheck de la API y base de datos
  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: 'connected',
      });
    } catch (_err) {
      res.status(503).json({
        status: 'error',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      });
    }
  });

  // Rutas de la API
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/packages', packagesRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api/track', trackingRouter);
  app.use('/api/stats', statsRouter);

  // Manejo de rutas inexistentes (404)
  app.use('*', (_req, _res, next) => {
    next(AppError.notFound('Ruta no encontrada'));
  });

  // Manejador global de errores
  app.use(errorHandler);

  return app;
};
