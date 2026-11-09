import { randomUUID } from 'node:crypto';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createSyncRouter } from '../../src/modules/sync/sync.router';
import { createPrismaSyncStore } from '../../src/modules/sync/sync.prisma-store';

/**
 * /sync contra PostgreSQL real (BD de prueba aislada). Requiere DATABASE_URL a una BD *_test
 * con las migraciones aplicadas:  npm run test:int -w @envio/api
 */
const url = process.env.DATABASE_URL ?? '';
if (!/\/[^/?]*_test(\?|$)/.test(url)) {
  throw new Error('DATABASE_URL debe apuntar a una base *_test: esta prueba vacía las tablas.');
}

const prisma = new PrismaClient();

/** App mínima: el usuario viene en un header para no depender del módulo de auth. */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: Request & { user?: { id: string } }, _res: Response, next: NextFunction) => {
    const id = req.header('x-test-user');
    if (id) req.user = { id };
    next();
  });
  app.use('/api/sync', createSyncRouter(createPrismaSyncStore(prisma)));
  return app;
}
const app = buildApp();

let adminId: string;
let chofer1: string;
let chofer2: string;
const T0 = new Date('2026-11-09T15:00:00.000Z');
const at = (min: number) => new Date(T0.getTime() + min * 60_000).toISOString();

async function nuevoPaquete(repartidorId: string) {
  const pkg = await prisma.package.create({
    data: {
      guia: `INT-${randomUUID().slice(0, 8)}`, destinatario: 'Prueba', direccion: 'Centro, Oaxaca',
      lat: 17.06, lng: -96.72, estado: 'ASIGNADO', repartidorId,
      eventos: {
        create: [
          { tipo: 'CREADO', userId: adminId, clientEventId: randomUUID(), ocurridoEn: T0 },
          { tipo: 'ASIGNADO', userId: adminId, repartidorId, clientEventId: randomUUID(), ocurridoEn: T0 },
        ],
      },
    },
  });
  return pkg.id;
}

const sync = (userId: string, events: object[]) =>
  request(app).post('/api/sync').set('x-test-user', userId).send({ events });

const entregado = (packageId: string, min: number, clientEventId = randomUUID()) => ({
  clientEventId, packageId, tipo: 'ENTREGADO', ocurridoEn: at(min), lat: 17.06, lng: -96.72, fotoUrl: '/uploads/foto.jpg',
});
const enRuta = (packageId: string, min: number, clientEventId = randomUUID()) => ({
  clientEventId, packageId, tipo: 'EN_RUTA', ocurridoEn: at(min),
});

beforeAll(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "PackageEvent", "Package", "RefreshToken", "User" CASCADE');
  const mk = (n: string, rol: 'ADMIN' | 'REPARTIDOR') =>
    prisma.user.create({ data: { nombre: n, email: `${n}@int.test`, passwordHash: 'x', rol } });
  [adminId, chofer1, chofer2] = (await Promise.all([mk('admin', 'ADMIN'), mk('chofer1', 'REPARTIDOR'), mk('chofer2', 'REPARTIDOR')])).map((u) => u.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/sync contra PostgreSQL', () => {
  it('guarda el evento y actualiza el estado del paquete en la misma transacción', async () => {
    const pkgId = await nuevoPaquete(chofer1);
    const ev = enRuta(pkgId, 5);
    const res = await sync(chofer1, [ev]);

    expect(res.status).toBe(200);
    expect(res.body.results[0]).toMatchObject({ status: 'ACCEPTED', packageEstado: 'EN_RUTA' });
    const guardado = await prisma.packageEvent.findUnique({ where: { clientEventId: ev.clientEventId } });
    expect(guardado).toMatchObject({ tipo: 'EN_RUTA', userId: chofer1, requiereRevision: false });
    expect((await prisma.package.findUniqueOrThrow({ where: { id: pkgId } })).estado).toBe('EN_RUTA');
  });

  it('es idempotente: reenviar el mismo lote no duplica filas', async () => {
    const pkgId = await nuevoPaquete(chofer1);
    const lote = [enRuta(pkgId, 5), entregado(pkgId, 10)];

    const r1 = await sync(chofer1, lote);
    const r2 = await sync(chofer1, lote);

    expect(r1.body.results.map((r: { status: string }) => r.status)).toEqual(['ACCEPTED', 'ACCEPTED']);
    expect(r2.body.results.map((r: { status: string }) => r.status)).toEqual(['DUPLICATE', 'DUPLICATE']);
    expect(await prisma.packageEvent.count({ where: { packageId: pkgId } })).toBe(4); // CREADO, ASIGNADO + 2
    expect((await prisma.package.findUniqueOrThrow({ where: { id: pkgId } })).estado).toBe('ENTREGADO');
  });

  it('dos envíos simultáneos del mismo evento: uno se acepta y el otro sale DUPLICATE (índice único)', async () => {
    const pkgId = await nuevoPaquete(chofer1);
    const ev = enRuta(pkgId, 5);

    const [a, b] = await Promise.all([sync(chofer1, [ev]), sync(chofer1, [ev])]);
    const estados = [a.body.results[0].status, b.body.results[0].status].sort();

    expect(estados).toEqual(['ACCEPTED', 'DUPLICATE']);
    expect(await prisma.packageEvent.count({ where: { clientEventId: ev.clientEventId } })).toBe(1);
  });

  it('no retrocede: un EN_RUTA viejo que llega tarde se guarda pero no cambia el estado', async () => {
    const pkgId = await nuevoPaquete(chofer1);
    await sync(chofer1, [{ ...enRuta(pkgId, 20), tipo: 'INTENTO_FALLIDO', motivo: 'No había nadie' }]);
    const tarde = await sync(chofer1, [enRuta(pkgId, 10)]);

    expect(tarde.body.results[0]).toMatchObject({ status: 'ACCEPTED', packageEstado: 'FALLIDO' });
    expect((await prisma.package.findUniqueOrThrow({ where: { id: pkgId } })).estado).toBe('FALLIDO');
  });

  it('ENTREGADO es terminal: un evento posterior no lo mueve', async () => {
    const pkgId = await nuevoPaquete(chofer1);
    await sync(chofer1, [entregado(pkgId, 10)]);
    const res = await sync(chofer1, [{ ...enRuta(pkgId, 30), tipo: 'INTENTO_FALLIDO', motivo: 'Cerrado' }]);

    expect(res.body.results[0]).toMatchObject({ status: 'ACCEPTED', requiereRevision: true, packageEstado: 'ENTREGADO' });
    expect((await prisma.package.findUniqueOrThrow({ where: { id: pkgId } })).estado).toBe('ENTREGADO');
  });

  it('chofer reasignado: su ENTREGADO offline se acepta y queda marcado para revisión', async () => {
    const pkgId = await nuevoPaquete(chofer1);
    await prisma.$transaction([
      prisma.package.update({ where: { id: pkgId }, data: { repartidorId: chofer2 } }),
      prisma.packageEvent.create({
        data: { packageId: pkgId, tipo: 'ASIGNADO', userId: adminId, repartidorId: chofer2, clientEventId: randomUUID(), ocurridoEn: new Date(at(1)) },
      }),
    ]);

    const res = await sync(chofer1, [entregado(pkgId, 15)]);

    expect(res.body.results[0]).toMatchObject({ status: 'ACCEPTED', requiereRevision: true, packageEstado: 'ENTREGADO' });
    expect(await prisma.packageEvent.count({ where: { packageId: pkgId, requiereRevision: true } })).toBe(1);
  });

  it('rechaza eventos de un chofer que nunca tuvo el paquete y de paquetes inexistentes', async () => {
    const pkgId = await nuevoPaquete(chofer1);
    const res = await sync(chofer2, [enRuta(pkgId, 5), enRuta(randomUUID(), 5)]);

    expect(res.body.results.map((r: { reason: string }) => r.reason)).toEqual(['NOT_YOUR_PACKAGE', 'PACKAGE_NOT_FOUND']);
    expect(await prisma.packageEvent.count({ where: { packageId: pkgId, userId: chofer2 } })).toBe(0);
  });

  it('responde 401 sin usuario autenticado', async () => {
    const res = await request(app).post('/api/sync').send({ events: [enRuta(randomUUID(), 1)] });
    expect(res.status).toBe(401);
  });
});
