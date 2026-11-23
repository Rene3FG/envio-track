import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

// Mock de Prisma para aislar la prueba y asegurar que corra rápidamente
jest.mock('../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('Auth Module Integration Tests (/api/auth)', () => {
  const app = createApp();

  const mockUser = {
    id: 'user-uuid-123',
    nombre: 'Admin Test',
    email: 'admin@envio.test',
    passwordHash: bcrypt.hashSync('cambiar123', 10),
    rol: 'ADMIN' as const,
    activo: true,
    creadoEn: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('debe responder 400 VALIDATION_ERROR si faltan campos o email es inválido', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'correo-invalido' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('debe responder 401 si el usuario no existe', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'noexiste@envio.test', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(res.body.error.message).toBe('Credenciales inválidas');
    });

    it('debe responder 401 si la contraseña es incorrecta', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@envio.test', password: 'clave-incorrecta' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('debe responder 401 si el usuario está inactivo (activo: false)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        activo: false,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@envio.test', password: 'cambiar123' });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('inactivo');
    });

    it('debe autenticar con éxito y devolver 200 con accessToken, refreshToken y user sin passwordHash', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@envio.test', password: 'cambiar123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user).toEqual({
        id: mockUser.id,
        nombre: mockUser.nombre,
        email: mockUser.email,
        rol: mockUser.rol,
        activo: mockUser.activo,
        creadoEn: mockUser.creadoEn.toISOString(),
      });
      expect(res.body.user.passwordHash).toBeUndefined();
    });
  });

  describe('GET /api/auth/me', () => {
    it('debe responder 401 si no se envía header Authorization', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('debe responder 200 con los datos del usuario si el JWT es válido', async () => {
      const token = jwt.sign(
        { id: mockUser.id, email: mockUser.email, rol: mockUser.rol },
        env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(mockUser.id);
      expect(res.body.email).toBe(mockUser.email);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('debe responder 401 y revocar todas las sesiones si se detecta reuso de un token revocado', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'token-1',
        tokenHash: 'hash-antiguo',
        userId: mockUser.id,
        expiraEn: new Date(Date.now() + 100000),
        revocado: true, // Ya fue revocado previamente
        user: mockUser,
      });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'token-robado-o-reusado' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        data: { revocado: true },
      });
    });

    it('debe rotar el token exitosamente si es válido', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'token-1',
        tokenHash: 'hash-valido',
        userId: mockUser.id,
        expiraEn: new Date(Date.now() + 100000),
        revocado: false,
        user: mockUser,
      });

      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'token-valido-actual' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('debe responder 204 y marcar el token como revocado', async () => {
      const token = jwt.sign(
        { id: mockUser.id, email: mockUser.email, rol: mockUser.rol },
        env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      (prisma.refreshToken.findFirst as jest.Mock).mockResolvedValue({
        id: 'token-1',
        revocado: false,
      });

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken: 'token-a-revocar' });

      expect(res.status).toBe(204);
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-1' },
        data: { revocado: true },
      });
    });
  });
});
