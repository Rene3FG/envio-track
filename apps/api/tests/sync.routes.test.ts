import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { env } from '../src/config/env';

// /api/sync montado en la app real: JWT y roles de P1 + validación del contrato compartido.
jest.mock('../src/config/prisma', () => ({
  prisma: {
    package: { findUnique: jest.fn(), update: jest.fn() },
    packageEvent: { count: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

const CHOFER = '00000000-0000-4000-8000-000000000002';
const PKG = '00000000-0000-4000-8000-000000000100';
const EVENTO = { clientEventId: '00000000-0000-4000-8000-000000000999', packageId: PKG, tipo: 'EN_RUTA', ocurridoEn: '2026-11-09T15:00:00.000Z' };

const token = (rol: 'ADMIN' | 'REPARTIDOR') =>
  jwt.sign({ id: CHOFER, email: 'chofer@envio.test', rol }, env.JWT_SECRET, { expiresIn: '5m' });

describe('POST /api/sync (app completa)', () => {
  const app = createApp();

  it('401 sin token', async () => {
    const res = await request(app).post('/api/sync').send({ events: [EVENTO] });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('403 si el usuario no es repartidor', async () => {
    const res = await request(app).post('/api/sync').set('Authorization', `Bearer ${token('ADMIN')}`).send({ events: [EVENTO] });
    expect(res.status).toBe(403);
  });

  it('400 VALIDATION_ERROR si el body no cumple el contrato', async () => {
    const res = await request(app).post('/api/sync').set('Authorization', `Bearer ${token('REPARTIDOR')}`).send({ events: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('200 con el resultado por evento para el repartidor asignado', async () => {
    (prisma.package.findUnique as jest.Mock).mockResolvedValue({ id: PKG, estado: 'ASIGNADO', repartidorId: CHOFER });
    (prisma.packageEvent.count as jest.Mock).mockResolvedValue(0);
    (prisma.packageEvent.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.$transaction as jest.Mock).mockResolvedValue([]);

    const res = await request(app).post('/api/sync').set('Authorization', `Bearer ${token('REPARTIDOR')}`).send({ events: [EVENTO] });

    expect(res.status).toBe(200);
    expect(res.body.results[0]).toMatchObject({ status: 'ACCEPTED', packageEstado: 'EN_RUTA' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('500 genérico si falla la base de datos', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (prisma.package.findUnique as jest.Mock).mockRejectedValue(new Error('BD caída'));

    const res = await request(app).post('/api/sync').set('Authorization', `Bearer ${token('REPARTIDOR')}`).send({ events: [EVENTO] });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
  });
});
