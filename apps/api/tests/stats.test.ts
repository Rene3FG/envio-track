import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    package: {
      count: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    packageEvent: {
      findMany: jest.fn(),
    },
  },
}));

describe('Stats Module Integration Tests (GET /api/stats)', () => {
  const app = createApp();

  const adminToken = jwt.sign(
    { id: 'admin-id', email: 'admin@envio.test', rol: 'ADMIN' },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const repartidorToken = jwt.sign(
    { id: 'rep-id', email: 'chofer@envio.test', rol: 'REPARTIDOR' },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe responder 401 si no hay token de autenticación', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(401);
  });

  it('debe responder 403 si un REPARTIDOR intenta consultar las estadísticas', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${repartidorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('debe responder 200 con la estructura StatsDto completa para ADMIN', async () => {
    // Mock de conteos por estado
    (prisma.package.count as jest.Mock)
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(10)  // REGISTRADO
      .mockResolvedValueOnce(20)  // ASIGNADO
      .mockResolvedValueOnce(15)  // EN_RUTA
      .mockResolvedValueOnce(50)  // ENTREGADO
      .mockResolvedValueOnce(5)   // FALLIDO
      .mockResolvedValueOnce(3);  // requierenRevision

    // Mock de repartidores
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'rep-1',
        nombre: 'Chofer Juan',
        paquetes: [
          { estado: 'ENTREGADO' },
          { estado: 'ENTREGADO' },
          { estado: 'FALLIDO' },
        ],
      },
    ]);

    // Mock de eventos de entrega por día
    (prisma.packageEvent.findMany as jest.Mock).mockResolvedValue([
      { ocurridoEn: new Date('2026-11-20T14:30:00Z') },
      { ocurridoEn: new Date('2026-11-20T16:00:00Z') },
      { ocurridoEn: new Date('2026-11-19T10:00:00Z') },
    ]);

    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(100);
    expect(res.body.porEstado).toEqual({
      REGISTRADO: 10,
      ASIGNADO: 20,
      EN_RUTA: 15,
      ENTREGADO: 50,
      FALLIDO: 5,
    });
    expect(res.body.requierenRevision).toBe(3);

    expect(res.body.porRepartidor).toEqual([
      {
        repartidorId: 'rep-1',
        nombre: 'Chofer Juan',
        entregados: 2,
        fallidos: 1,
      },
    ]);

    expect(res.body.entregadosPorDia).toEqual([
      { fecha: '2026-11-20', total: 2 },
      { fecha: '2026-11-19', total: 1 },
    ]);
  });
});
