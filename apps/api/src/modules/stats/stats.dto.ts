import { z } from 'zod';
import { PackageStatus } from '@prisma/client';

export const statsQuerySchema = z.object({
  desde: z.string().datetime().optional(),
  hasta: z.string().datetime().optional(),
});

export type StatsQueryDto = z.infer<typeof statsQuerySchema>;

export interface RepartidorStatsDto {
  repartidorId: string;
  nombre: string;
  entregados: number;
  fallidos: number;
}

export interface EntregasPorDiaDto {
  fecha: string;
  total: number;
}

export interface StatsDto {
  total: number;
  porEstado: Record<PackageStatus, number>;
  requierenRevision: number;
  porRepartidor: RepartidorStatsDto[];
  entregadosPorDia: EntregasPorDiaDto[];
}
