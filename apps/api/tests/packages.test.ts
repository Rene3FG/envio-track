import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

jest.mock('../src/config/prisma', () => {
  const mockClient = {
    package: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    packageEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  mockClient.$transaction.mockImplementation(async (callbackOrList: any) => {
    if (typeof callbackOrList === 'function') {
      return await callbackOrList(mockClient);
    }
    return Promise.all(callbackOrList);
  });

  return {
    prisma: mockClient,
  };
});

describe('Packages Module Integration Tests (/api/packages)', () => {
  const app = createApp();

  const adminToken = jwt.sign(
    { id: 'admin-123', email: 'admin@envio.test', rol: 'ADMIN' },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const repartidor1Token = jwt.sign(
    { id: 'rep-1', email: 'chofer1@envio.test', rol: 'REPARTIDOR' },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const repartidor2Token = jwt.sign(
    { id: 'rep-2', email: 'chofer2@envio.test', rol: 'REPARTIDOR' },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const mockPackage = {
    id: 'pkg-uuid-1',
    guia: 'ET-123456',
    destinatario: 'Carlos Pérez',
    telefonoDestinatario: '5551234567',
    direccion: 'Av. Reforma 100',
    referencias: 'Puerta blanca',
    lat: 19.4326,
    lng: -99.1332,
    urgente: false,
    estado: 'REGISTRADO' as const,
    repartidorId: null,
    repartidor: null,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reasegurar la implementación de $transaction después de clearAllMocks
    (prisma.$transaction as jest.Mock).mockImplementation(async (callbackOrList: any) => {
      if (typeof callbackOrList === 'function') {
        return await callbackOrList(prisma);
      }
      return Promise.all(callbackOrList);
    });
  });

  describe('POST /api/packages (Alta de paquetes)', () => {
    it('debe responder 403 si un REPARTIDOR intenta dar de alta un paquete', async () => {
      const res = await request(app)
        .post('/api/packages')
        .set('Authorization', `Bearer ${repartidor1Token}`)
        .send({
          destinatario: 'Laura Gómez',
          direccion: 'Calle Luna 45',
          lat: 19.43,
          lng: -99.13,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('debe responder 400 si faltan coordenadas lat/lng obligatorias o están fuera de rango', async () => {
      const res = await request(app)
        .post('/api/packages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          destinatario: 'Laura Gómez',
          direccion: 'Calle Luna 45',
          lat: 150,
          lng: -99.13,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('debe crear un paquete con guía ET-XXXXXX, estado REGISTRADO y registrar el evento CREADO', async () => {
      (prisma.package.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.package.create as jest.Mock).mockResolvedValue(mockPackage);
      (prisma.packageEvent.create as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .post('/api/packages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          destinatario: 'Carlos Pérez',
          telefonoDestinatario: '5551234567',
          direccion: 'Av. Reforma 100',
          referencias: 'Puerta blanca',
          lat: 19.4326,
          lng: -99.1332,
          urgente: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.guia).toMatch(/^ET-\d{6}$/);
      expect(res.body.estado).toBe('REGISTRADO');
      expect(prisma.packageEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'CREADO',
            userId: 'admin-123',
          }),
        })
      );
    });
  });

  describe('GET /api/packages (Listado con filtros)', () => {
    it('ADMIN debe poder consultar paquetes con paginación', async () => {
      (prisma.package.count as jest.Mock).mockResolvedValue(1);
      (prisma.package.findMany as jest.Mock).mockResolvedValue([mockPackage]);

      const res = await request(app)
        .get('/api/packages?page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.page).toBe(1);
      expect(res.body.total).toBe(1);
    });

    it('REPARTIDOR solo debe consultar paquetes asignados a él', async () => {
      (prisma.package.count as jest.Mock).mockResolvedValue(1);
      (prisma.package.findMany as jest.Mock).mockResolvedValue([
        { ...mockPackage, repartidorId: 'rep-1' },
      ]);

      const res = await request(app)
        .get('/api/packages')
        .set('Authorization', `Bearer ${repartidor1Token}`);

      expect(res.status).toBe(200);
      expect(prisma.package.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            repartidorId: 'rep-1',
          }),
        })
      );
    });
  });

  describe('GET /api/packages/:id (Detalle de paquete)', () => {
    it('debe responder 404 si el paquete no existe', async () => {
      (prisma.package.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/packages/no-existe')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('debe responder 403 si un REPARTIDOR intenta consultar un paquete que no le pertenece', async () => {
      (prisma.package.findUnique as jest.Mock).mockResolvedValue({
        ...mockPackage,
        repartidorId: 'rep-1',
        eventos: [],
      });

      const res = await request(app)
        .get('/api/packages/pkg-uuid-1')
        .set('Authorization', `Bearer ${repartidor2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('debe devolver 200 con historial de eventos si es ADMIN', async () => {
      (prisma.package.findUnique as jest.Mock).mockResolvedValue({
        ...mockPackage,
        eventos: [
          {
            id: 'ev-1',
            packageId: mockPackage.id,
            tipo: 'CREADO',
            userId: 'admin-123',
            user: { id: 'admin-123', nombre: 'Admin' },
            repartidorId: null,
            repartidor: null,
            motivo: null,
            lat: 19.43,
            lng: -99.13,
            fotoUrl: null,
            clientEventId: 'client-1',
            requiereRevision: false,
            ocurridoEn: new Date(),
            recibidoEn: new Date(),
          },
        ],
      });

      const res = await request(app)
        .get('/api/packages/pkg-uuid-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(mockPackage.id);
      expect(res.body.eventos).toHaveLength(1);
      expect(res.body.eventos[0].tipo).toBe('CREADO');
    });
  });

  describe('POST /api/packages/:id/assignment (Asignación de paquetes)', () => {
    const validDriverId = '11111111-1111-1111-1111-111111111111';

    it('debe responder 409 si el paquete ya está en estado ENTREGADO', async () => {
      (prisma.package.findUnique as jest.Mock).mockResolvedValue({
        ...mockPackage,
        estado: 'ENTREGADO',
      });

      const res = await request(app)
        .post('/api/packages/pkg-uuid-1/assignment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ repartidorId: validDriverId });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('ENTREGADO');
    });

    it('debe responder 409 si el chofer no existe, no está activo o no es REPARTIDOR', async () => {
      (prisma.package.findUnique as jest.Mock).mockResolvedValue(mockPackage);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: validDriverId,
        rol: 'ADMIN',
        activo: true,
      });

      const res = await request(app)
        .post('/api/packages/pkg-uuid-1/assignment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ repartidorId: validDriverId });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('debe asignar exitosamente al repartidor, cambiar estado a ASIGNADO y crear evento ASIGNADO', async () => {
      (prisma.package.findUnique as jest.Mock).mockResolvedValue(mockPackage);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: validDriverId,
        nombre: 'Chofer Uno',
        rol: 'REPARTIDOR',
        activo: true,
      });

      const assignedPkg = {
        ...mockPackage,
        estado: 'ASIGNADO' as const,
        repartidorId: validDriverId,
        repartidor: { id: validDriverId, nombre: 'Chofer Uno' },
      };

      (prisma.package.update as jest.Mock).mockResolvedValue(assignedPkg);
      (prisma.packageEvent.create as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .post('/api/packages/pkg-uuid-1/assignment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ repartidorId: validDriverId });

      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('ASIGNADO');
      expect(res.body.repartidor.id).toBe(validDriverId);
      expect(prisma.packageEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'ASIGNADO',
            repartidorId: validDriverId,
            userId: 'admin-123',
          }),
        })
      );
    });
  });

  describe('GET /api/packages/mine/route', () => {
    it('debe responder 403 si un ADMIN intenta acceder a la ruta de repartidor', async () => {
      const res = await request(app)
        .get('/api/packages/mine/route')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('debe responder 200 con los paquetes activos (ASIGNADO/EN_RUTA) del repartidor', async () => {
      (prisma.package.findMany as jest.Mock).mockResolvedValue([
        { ...mockPackage, estado: 'ASIGNADO', repartidorId: 'rep-1' },
      ]);

      const res = await request(app)
        .get('/api/packages/mine/route')
        .set('Authorization', `Bearer ${repartidor1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].estado).toBe('ASIGNADO');
    });
  });

  describe('PATCH /api/packages/:id (Actualización de paquete)', () => {
    it('debe responder 403 si un REPARTIDOR intenta editar un paquete', async () => {
      const res = await request(app)
        .patch('/api/packages/pkg-uuid-1')
        .set('Authorization', `Bearer ${repartidor1Token}`)
        .send({ destinatario: 'Nuevo Destinatario' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('debe responder 404 si el paquete no existe', async () => {
      (prisma.package.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/packages/no-existe')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ destinatario: 'Nuevo Destinatario' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('debe responder 409 si el paquete ya está en estado ENTREGADO', async () => {
      (prisma.package.findUnique as jest.Mock).mockResolvedValue({
        ...mockPackage,
        estado: 'ENTREGADO',
      });

      const res = await request(app)
        .patch('/api/packages/pkg-uuid-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ destinatario: 'Intento Editar Entregado' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('debe actualizar los datos del paquete exitosamente y responder 200', async () => {
      (prisma.package.findUnique as jest.Mock).mockResolvedValue(mockPackage);
      (prisma.package.update as jest.Mock).mockResolvedValue({
        ...mockPackage,
        destinatario: 'Destinatario Modificado',
        urgente: true,
      });

      const res = await request(app)
        .patch('/api/packages/pkg-uuid-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ destinatario: 'Destinatario Modificado', urgente: true });

      expect(res.status).toBe(200);
      expect(res.body.destinatario).toBe('Destinatario Modificado');
      expect(res.body.urgente).toBe(true);
    });
  });
});
