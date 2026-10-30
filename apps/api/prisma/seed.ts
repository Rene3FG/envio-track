import { randomUUID } from 'node:crypto';
import { PrismaClient, EventType, PackageStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Solo datos de prueba para desarrollo. Contraseña de todos: "cambiar123".
const PASSWORD = process.env.SEED_PASSWORD ?? 'cambiar123';

// Paradas de ejemplo en el centro de Oaxaca de Juárez.
const PAQUETES = [
  { guia: 'ET-0001', destinatario: 'Cliente Prueba 1', direccion: 'Calle Macedonio Alcalá 100, Centro', lat: 17.0609, lng: -96.7255, urgente: true },
  { guia: 'ET-0002', destinatario: 'Cliente Prueba 2', direccion: 'Av. Independencia 500, Centro', lat: 17.0583, lng: -96.7231, urgente: false },
  { guia: 'ET-0003', destinatario: 'Cliente Prueba 3', direccion: 'Calzada Madero 300, Colonia Reforma', lat: 17.0701, lng: -96.7155, urgente: false },
  { guia: 'ET-0004', destinatario: 'Cliente Prueba 4', direccion: 'Calle Hidalgo 45, Jalatlaco', lat: 17.0668, lng: -96.7120, urgente: false },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@envio.test' },
    update: {},
    create: { nombre: 'Admin Prueba', email: 'admin@envio.test', passwordHash, rol: 'ADMIN' },
  });

  const repartidores = await Promise.all(
    [1, 2].map((n) =>
      prisma.user.upsert({
        where: { email: `repartidor${n}@envio.test` },
        update: {},
        create: {
          nombre: `Repartidor Prueba ${n}`,
          email: `repartidor${n}@envio.test`,
          passwordHash,
          rol: 'REPARTIDOR',
        },
      }),
    ),
  );

  for (const [i, p] of PAQUETES.entries()) {
    const existente = await prisma.package.findUnique({ where: { guia: p.guia } });
    if (existente) continue; // idempotente: no duplica ni toca lo ya sembrado

    const repartidor = repartidores[i % repartidores.length];
    const ahora = new Date();

    // Alta + asignación en una sola transacción, igual que hará la API.
    await prisma.$transaction([
      prisma.package.create({
        data: {
          ...p,
          estado: PackageStatus.ASIGNADO,
          repartidorId: repartidor.id,
          eventos: {
            create: [
              {
                tipo: EventType.CREADO,
                userId: admin.id,
                clientEventId: randomUUID(),
                ocurridoEn: ahora,
              },
              {
                tipo: EventType.ASIGNADO,
                userId: admin.id,
                repartidorId: repartidor.id, // solo en eventos ASIGNADO
                clientEventId: randomUUID(),
                ocurridoEn: ahora,
              },
            ],
          },
        },
      }),
    ]);
  }

  const [usuarios, paquetes, eventos] = await Promise.all([
    prisma.user.count(),
    prisma.package.count(),
    prisma.packageEvent.count(),
  ]);
  console.log(`Seed listo: ${usuarios} usuarios, ${paquetes} paquetes, ${eventos} eventos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
