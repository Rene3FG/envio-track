import { z } from 'zod';
import { PackageStatus, EventType } from '@prisma/client';

export const createPackageSchema = z.object({
  destinatario: z.string().trim().min(2, 'El nombre del destinatario es requerido (mínimo 2 caracteres)'),
  telefonoDestinatario: z.string().trim().optional(),
  direccion: z.string().trim().min(3, 'La dirección es requerida (mínimo 3 caracteres)'),
  referencias: z.string().trim().optional(),
  lat: z.number().min(-90).max(90, 'Latitud debe estar entre -90 y 90'),
  lng: z.number().min(-180).max(180, 'Longitud debe estar entre -180 y 180'),
  urgente: z.boolean().optional().default(false),
});

export type CreatePackageDto = z.infer<typeof createPackageSchema>;

export const updatePackageSchema = z.object({
  destinatario: z.string().trim().min(2).optional(),
  telefonoDestinatario: z.string().trim().optional(),
  direccion: z.string().trim().min(3).optional(),
  referencias: z.string().trim().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  urgente: z.boolean().optional(),
});

export type UpdatePackageDto = z.infer<typeof updatePackageSchema>;

export const assignPackageSchema = z.object({
  repartidorId: z.string().uuid('El ID del repartidor debe ser un UUID válido'),
});

export type AssignPackageDto = z.infer<typeof assignPackageSchema>;

export const getPackagesQuerySchema = z.object({
  estado: z.nativeEnum(PackageStatus).optional(),
  repartidorId: z.string().uuid().optional(),
  requiereRevision: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
  q: z.string().trim().optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  pageSize: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 20)) : 20)),
});

export type GetPackagesQueryDto = z.infer<typeof getPackagesQuerySchema>;

export interface PackageRepartidorDto {
  id: string;
  nombre: string;
}

export interface PackageDto {
  id: string;
  guia: string;
  destinatario: string;
  telefonoDestinatario: string | null;
  direccion: string;
  referencias: string | null;
  lat: number;
  lng: number;
  urgente: boolean;
  estado: PackageStatus;
  repartidor: PackageRepartidorDto | null;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface PackageEventDto {
  id: string;
  packageId: string;
  tipo: EventType;
  userId: string;
  user?: { id: string; nombre: string };
  repartidorId: string | null;
  repartidor?: { id: string; nombre: string } | null;
  motivo: string | null;
  lat: number | null;
  lng: number | null;
  fotoUrl: string | null;
  clientEventId: string;
  requiereRevision: boolean;
  ocurridoEn: Date;
  recibidoEn: Date;
}

export interface PackageDetailDto extends PackageDto {
  eventos: PackageEventDto[];
}

export interface PaginatedPackagesResponseDto {
  data: PackageDto[];
  page: number;
  pageSize: number;
  total: number;
}
