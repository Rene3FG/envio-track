import { randomUUID } from 'crypto';
import { Package, User, Prisma, PackageStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../errors/app-error';
import { AuthUserPayload } from '../../types/express';
import {
  CreatePackageDto,
  UpdatePackageDto,
  GetPackagesQueryDto,
  PackageDto,
  PackageDetailDto,
  PaginatedPackagesResponseDto,
} from './packages.dto';

type PackageWithRepartidor = Package & {
  repartidor?: Pick<User, 'id' | 'nombre'> | null;
};

export class PackagesService {
  private formatPackage(pkg: PackageWithRepartidor): PackageDto {
    return {
      id: pkg.id,
      guia: pkg.guia,
      destinatario: pkg.destinatario,
      telefonoDestinatario: pkg.telefonoDestinatario,
      direccion: pkg.direccion,
      referencias: pkg.referencias,
      lat: pkg.lat,
      lng: pkg.lng,
      urgente: pkg.urgente,
      estado: pkg.estado,
      repartidor: pkg.repartidor ? { id: pkg.repartidor.id, nombre: pkg.repartidor.nombre } : null,
      creadoEn: pkg.creadoEn,
      actualizadoEn: pkg.actualizadoEn,
    };
  }

  private async generateUniqueGuia(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      const guia = `ET-${randomNum}`;

      const existing = await prisma.package.findUnique({
        where: { guia },
        select: { id: true },
      });

      if (!existing) {
        return guia;
      }
    }
    // Fallback con timestamp de 6 dígitos si hubiese colisión repetida
    return `ET-${Date.now().toString().slice(-6)}`;
  }

  async createPackage(adminUserId: string, dto: CreatePackageDto): Promise<PackageDto> {
    const guia = await this.generateUniqueGuia();
    const clientEventId = randomUUID();

    const createdPackage = await prisma.$transaction(async (tx) => {
      const pkg = await tx.package.create({
        data: {
          guia,
          destinatario: dto.destinatario,
          telefonoDestinatario: dto.telefonoDestinatario,
          direccion: dto.direccion,
          referencias: dto.referencias,
          lat: dto.lat,
          lng: dto.lng,
          urgente: dto.urgente ?? false,
          estado: 'REGISTRADO',
        },
      });

      await tx.packageEvent.create({
        data: {
          packageId: pkg.id,
          tipo: 'CREADO',
          userId: adminUserId,
          lat: dto.lat,
          lng: dto.lng,
          clientEventId,
          requiereRevision: false,
          ocurridoEn: new Date(),
        },
      });

      return pkg;
    });

    return this.formatPackage(createdPackage);
  }

  async getPackages(
    user: AuthUserPayload,
    query: GetPackagesQueryDto
  ): Promise<PaginatedPackagesResponseDto> {
    const { estado, repartidorId, requiereRevision, q, page = 1, pageSize = 20 } = query;

    const where: Prisma.PackageWhereInput = {};

    // REPARTIDOR solo ve sus propios paquetes
    if (user.rol === 'REPARTIDOR') {
      where.repartidorId = user.id;
    } else if (repartidorId) {
      where.repartidorId = repartidorId;
    }

    if (estado) {
      where.estado = estado;
    }

    if (requiereRevision !== undefined) {
      where.eventos = {
        some: {
          requiereRevision,
        },
      };
    }

    if (q) {
      where.OR = [
        { guia: { contains: q, mode: 'insensitive' } },
        { destinatario: { contains: q, mode: 'insensitive' } },
        { direccion: { contains: q, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [total, packages] = await Promise.all([
      prisma.package.count({ where }),
      prisma.package.findMany({
        where,
        skip,
        take,
        include: {
          repartidor: {
            select: { id: true, nombre: true },
          },
        },
        orderBy: [{ urgente: 'desc' }, { creadoEn: 'desc' }],
      }),
    ]);

    return {
      data: packages.map((pkg) => this.formatPackage(pkg)),
      page,
      pageSize,
      total,
    };
  }

  async getPackageById(id: string, user: AuthUserPayload): Promise<PackageDetailDto> {
    const pkg = await prisma.package.findUnique({
      where: { id },
      include: {
        repartidor: {
          select: { id: true, nombre: true },
        },
        eventos: {
          include: {
            user: { select: { id: true, nombre: true } },
            repartidor: { select: { id: true, nombre: true } },
          },
          orderBy: { ocurridoEn: 'asc' },
        },
      },
    });

    if (!pkg) {
      throw AppError.notFound('Paquete no encontrado');
    }

    // Un REPARTIDOR solo puede consultar el detalle de los paquetes asignados a él
    if (user.rol === 'REPARTIDOR' && pkg.repartidorId !== user.id) {
      throw AppError.forbidden('No tienes acceso para ver este paquete');
    }

    return {
      ...this.formatPackage(pkg),
      eventos: pkg.eventos.map((e) => ({
        id: e.id,
        packageId: e.packageId,
        tipo: e.tipo,
        userId: e.userId,
        user: e.user,
        repartidorId: e.repartidorId,
        repartidor: e.repartidor,
        motivo: e.motivo,
        lat: e.lat,
        lng: e.lng,
        fotoUrl: e.fotoUrl,
        clientEventId: e.clientEventId,
        requiereRevision: e.requiereRevision,
        ocurridoEn: e.ocurridoEn,
        recibidoEn: e.recibidoEn,
      })),
    };
  }

  async updatePackage(id: string, dto: UpdatePackageDto): Promise<PackageDto> {
    const existing = await prisma.package.findUnique({
      where: { id },
    });

    if (!existing) {
      throw AppError.notFound('Paquete no encontrado');
    }

    if (existing.estado === 'ENTREGADO') {
      throw AppError.conflict('No se pueden modificar datos de un paquete ya ENTREGADO');
    }

    const updated = await prisma.package.update({
      where: { id },
      data: {
        destinatario: dto.destinatario,
        telefonoDestinatario: dto.telefonoDestinatario,
        direccion: dto.direccion,
        referencias: dto.referencias,
        lat: dto.lat,
        lng: dto.lng,
        urgente: dto.urgente,
      },
      include: {
        repartidor: {
          select: { id: true, nombre: true },
        },
      },
    });

    return this.formatPackage(updated);
  }

  async assignPackage(packageId: string, repartidorId: string, adminUserId: string): Promise<PackageDto> {
    const clientEventId = randomUUID();

    const updatedPackage = await prisma.$transaction(async (tx) => {
      const pkg = await tx.package.findUnique({
        where: { id: packageId },
      });

      if (!pkg) {
        throw AppError.notFound('Paquete no encontrado');
      }

      // Regla de contrato: No se puede asignar un paquete ENTREGADO
      if (pkg.estado === 'ENTREGADO') {
        throw AppError.conflict('No se puede asignar ni reasignar un paquete en estado ENTREGADO');
      }

      // Validar repartidor: debe existir, estar activo y tener rol REPARTIDOR
      const driver = await tx.user.findUnique({
        where: { id: repartidorId },
      });

      if (!driver || !driver.activo || driver.rol !== 'REPARTIDOR') {
        throw AppError.conflict(
          'El usuario asignado debe existir, estar activo y contar con el rol REPARTIDOR'
        );
      }

      const assigned = await tx.package.update({
        where: { id: packageId },
        data: {
          repartidorId: driver.id,
          estado: 'ASIGNADO',
        },
        include: {
          repartidor: {
            select: { id: true, nombre: true },
          },
        },
      });

      // Crear evento histórico ASIGNADO en la misma transacción
      await tx.packageEvent.create({
        data: {
          packageId: pkg.id,
          tipo: 'ASIGNADO',
          userId: adminUserId,
          repartidorId: driver.id,
          clientEventId,
          requiereRevision: false,
          ocurridoEn: new Date(),
        },
      });

      return assigned;
    });

    return this.formatPackage(updatedPackage);
  }

  async getMineRoute(repartidorId: string): Promise<PackageDto[]> {
    const packages = await prisma.package.findMany({
      where: {
        repartidorId,
        estado: {
          in: ['ASIGNADO', 'EN_RUTA'],
        },
      },
      include: {
        repartidor: {
          select: { id: true, nombre: true },
        },
      },
      orderBy: [{ urgente: 'desc' }, { creadoEn: 'asc' }],
    });

    return packages.map((pkg) => this.formatPackage(pkg));
  }
}
