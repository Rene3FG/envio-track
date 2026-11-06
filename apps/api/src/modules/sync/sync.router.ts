import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { SyncRequestSchema } from '@envio/shared';
import { processSyncBatch } from './sync.service';
import type { SyncStore } from './sync.service';

/**
 * POST /api/sync. Se monta con el middleware de auth de P1, que debe dejar `req.user = { id, rol }`
 * y limitar la ruta al rol REPARTIDOR:
 *   app.use('/api/sync', authenticate, requireRole('REPARTIDOR'), createSyncRouter(store));
 * Los errores van a next() para el middleware de errores de P1 (ZodError → 400).
 */
export function createSyncRouter(store: SyncStore): Router {
  const router = Router();
  router.post('/', async (req: Request & { user?: { id: string } }, res: Response, next: NextFunction) => {
    try {
      const body = SyncRequestSchema.parse(req.body);
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'No autenticado' } });
      res.status(200).json(await processSyncBatch(store, req.user.id, body.events));
    } catch (err) {
      next(err);
    }
  });
  return router;
}
