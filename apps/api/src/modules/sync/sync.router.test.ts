import express from 'express';
import request from 'supertest';
import { ZodError } from 'zod';
import { createSyncRouter } from './sync.router';
import type { SyncStore } from './sync.service';

const U = '00000000-0000-4000-8000-000000000001';
const PKG = '00000000-0000-4000-8000-000000000100';
const store: SyncStore = {
  eventExists: async () => false,
  findPackage: async (id) => ({ id, estado: 'ASIGNADO', repartidorId: 'driver-1' }),
  wasEverAssigned: async () => true,
  lastStateEventAt: async () => null,
  saveEvent: async () => undefined,
};

function appWith(id: string | undefined) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = id ? { id, email: `${id}@envio.test`, rol: 'REPARTIDOR' } : undefined; next(); });
  app.use('/api/sync', createSyncRouter(store));
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err instanceof ZodError ? 400 : 500).json({ error: { code: err instanceof ZodError ? 'VALIDATION_ERROR' : 'INTERNAL' } });
  });
  return app;
}

describe('POST /api/sync', () => {
  it('200 con resultados por evento', async () => {
    const res = await request(appWith('driver-1')).post('/api/sync').send({
      events: [{ clientEventId: U, packageId: PKG, tipo: 'EN_RUTA', ocurridoEn: '2026-10-30T10:00:00.000Z' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.results[0]).toMatchObject({ clientEventId: U, status: 'ACCEPTED', packageEstado: 'EN_RUTA' });
  });
  it('400 si el body no cumple el contrato', async () => {
    const res = await request(appWith('driver-1')).post('/api/sync').send({ events: [] });
    expect(res.status).toBe(400);
  });
  it('401 sin usuario autenticado', async () => {
    const res = await request(appWith(undefined)).post('/api/sync').send({ events: [{}] });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
