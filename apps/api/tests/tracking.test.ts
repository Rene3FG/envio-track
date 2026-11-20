import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    package: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Tracking Module Integration Tests (GET /api/track/:guia)', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe responder 404 si la guía no existe', async () => {
    (prisma.package.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app).get('/api/track/ET-999999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('debe responder 200 con datos públicos, destinatario censurado y sin datos sensibles', async () => {
    const mockPackageWithEvents = {
      id: 'pkg-uuid-sensible',
      guia: 'ET-104920',
      destinatario: 'Juan Carlos Pérez Gómez',
      telefonoDestinatario: '555-123-4567',
      direccion: 'Calle Privada 123, Colonia Centro',
      referencias: 'Entre calle 1 y calle 2',
      lat: 19.4326,
      lng: -99.1332,
      estado: 'EN_RUTA' as const,
      repartidorId: 'rep-secret-id',
      eventos: [
        {
          id: 'event-id-1',
          packageId: 'pkg-uuid-sensible',
          tipo: 'CREADO' as const,
          userId: 'admin-id-1',
          repartidorId: null,
          lat: 19.4326,
          lng: -99.1332,
          fotoUrl: null,
          motivo: null,
          clientEventId: 'client-ev-1',
          requiereRevision: false,
          ocurridoEn: new Date('2026-11-20T10:00:00Z'),
          recibidoEn: new Date('2026-11-20T10:00:05Z'),
        },
        {
          id: 'event-id-2',
          packageId: 'pkg-uuid-sensible',
          tipo: 'EN_RUTA' as const,
          userId: 'rep-secret-id',
          repartidorId: 'rep-secret-id',
          lat: 19.435,
          lng: -99.135,
          fotoUrl: '/uploads/evidencia123.jpg',
          motivo: null,
          clientEventId: 'client-ev-2',
          requiereRevision: true,
          ocurridoEn: new Date('2026-11-20T11:00:00Z'),
          recibidoEn: new Date('2026-11-20T11:00:02Z'),
        },
      ],
    };

    (prisma.package.findUnique as jest.Mock).mockResolvedValue(mockPackageWithEvents);

    const res = await request(app).get('/api/track/ET-104920');

    expect(res.status).toBe(200);
    expect(res.body.guia).toBe('ET-104920');
    expect(res.body.estado).toBe('EN_RUTA');
    // Destinatario censurado: "J. C***"
    expect(res.body.destinatario).toBe('J. C***');

    // Seguridad: Campos sensibles no deben existir en la respuesta pública
    expect(res.body.id).toBeUndefined();
    expect(res.body.telefonoDestinatario).toBeUndefined();
    expect(res.body.direccion).toBeUndefined();
    expect(res.body.repartidorId).toBeUndefined();

    // Eventos públicos
    expect(res.body.eventos).toHaveLength(2);
    expect(res.body.eventos[0]).toEqual({
      tipo: 'CREADO',
      ocurridoEn: '2026-11-20T10:00:00.000Z',
      lat: 19.4326,
      lng: -99.1332,
      fotoUrl: null,
      motivo: null,
    });
    // Los eventos no deben filtrar clientEventId, requiereRevision ni IDs
    expect(res.body.eventos[1].clientEventId).toBeUndefined();
    expect(res.body.eventos[1].requiereRevision).toBeUndefined();
    expect(res.body.eventos[1].userId).toBeUndefined();
  });
});
