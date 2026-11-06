import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { DuplicateEventError } from './sync.service';
import type { NewEventRecord, SyncStore } from './sync.service';

export function createPrismaSyncStore(prisma: PrismaClient): SyncStore {
  return {
    async eventExists(clientEventId) {
      return (await prisma.packageEvent.count({ where: { clientEventId } })) > 0;
    },
    findPackage(id) {
      return prisma.package.findUnique({ where: { id }, select: { id: true, estado: true, repartidorId: true } });
    },
    async wasEverAssigned(packageId, userId) {
      return (await prisma.packageEvent.count({ where: { packageId, tipo: 'ASIGNADO', repartidorId: userId } })) > 0;
    },
    async lastStateEventAt(packageId) {
      const last = await prisma.packageEvent.findFirst({
        where: { packageId, tipo: { in: ['ASIGNADO', 'EN_RUTA', 'INTENTO_FALLIDO', 'ENTREGADO'] } },
        orderBy: { ocurridoEn: 'desc' },
        select: { ocurridoEn: true },
      });
      return last?.ocurridoEn ?? null;
    },
    async saveEvent(record: NewEventRecord, newEstado) {
      try {
        await prisma.$transaction([
          prisma.packageEvent.create({ data: record }),
          ...(newEstado ? [prisma.package.update({ where: { id: record.packageId }, data: { estado: newEstado } })] : []),
        ]);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new DuplicateEventError();
        throw err;
      }
    },
  };
}
