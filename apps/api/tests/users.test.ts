import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    package: {
      count: jest.fn(),
    },
  },
}));

describe('Users Module Integration Tests (/api/users)', () => {
  const app = createApp();

  const adminToken = jwt.sign(
    { id: 'admin-id', email: 'admin@envio.test', rol: 'ADMIN' },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const repartidorToken = jwt.sign(
    { id: 'repartidor-id', email: 'chofer@envio.test', rol: 'REPARTIDOR' },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const mockRepartidor = {
    id: 'user-rep-1',
    nombre: 'Chofer Juan',
    email: 'chofer1@envio.test',
    passwordHash: 'hashedpassword',
    rol: 'REPARTIDOR' as const,
    activo: true,
    creadoEn: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Control de acceso y autorización (RBAC)', () => {
    it('debe responder 401 si no hay token de autenticación', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('debe responder 403 si el usuario autenticado es REPARTIDOR', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${repartidorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/users', () => {
    it('debe listar usuarios con formato paginado y sin exponer passwordHash', async () => {
      (prisma.user.count as jest.Mock).mockResolvedValue(1);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockRepartidor]);

      const res = await request(app)
        .get('/api/users?rol=REPARTIDOR&activo=true&page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('pageSize', 10);
      expect(res.body).toHaveProperty('total', 1);
      expect(res.body.data[0].id).toBe(mockRepartidor.id);
      expect(res.body.data[0].passwordHash).toBeUndefined();
    });
  });

  describe('GET /api/users/:id', () => {
    it('debe responder 404 si el usuario no existe', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/users/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('debe responder 200 con el UserDto saneado', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockRepartidor);

      const res = await request(app)
        .get(`/api/users/${mockRepartidor.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(mockRepartidor.id);
      expect(res.body.nombre).toBe(mockRepartidor.nombre);
      expect(res.body.passwordHash).toBeUndefined();
    });
  });

  describe('POST /api/users', () => {
    it('debe responder 400 si faltan datos o el rol es inválido', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nombre: 'Test', email: 'correo-malo' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('debe responder 409 si el correo ya existe', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockRepartidor);

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Chofer Duplicado',
          email: 'chofer1@envio.test',
          password: 'password123',
          rol: 'REPARTIDOR',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('debe crear el usuario exitosamente y responder 201', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'new-user-id',
        nombre: 'Nuevo Chofer',
        email: 'nuevo@envio.test',
        passwordHash: 'hashedpassword',
        rol: 'REPARTIDOR',
        activo: true,
        creadoEn: new Date(),
      });

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Nuevo Chofer',
          email: 'nuevo@envio.test',
          password: 'password123',
          rol: 'REPARTIDOR',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('new-user-id');
      expect(res.body.email).toBe('nuevo@envio.test');
      expect(res.body.passwordHash).toBeUndefined();
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('debe responder 404 si el usuario no existe', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/users/not-found-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nombre: 'Nuevo Nombre' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('debe responder 409 si se intenta desactivar a un chofer con paquetes activos', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockRepartidor);
      // Simular que tiene 2 paquetes en estado ASIGNADO o EN_RUTA
      (prisma.package.count as jest.Mock).mockResolvedValue(2);

      const res = await request(app)
        .patch(`/api/users/${mockRepartidor.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ activo: false });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('paquete(s) activo(s)');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('debe desactivar con éxito si el chofer NO tiene paquetes activos', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockRepartidor);
      (prisma.package.count as jest.Mock).mockResolvedValue(0);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockRepartidor,
        activo: false,
      });

      const res = await request(app)
        .patch(`/api/users/${mockRepartidor.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ activo: false });

      expect(res.status).toBe(200);
      expect(res.body.activo).toBe(false);
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });
});
