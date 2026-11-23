import { PackageStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { StatsDto, StatsQueryDto, RepartidorStatsDto, EntregasPorDiaDto } from './stats.dto';

export class StatsService {
  async getStats(query: StatsQueryDto): Promise<StatsDto> {
    const { desde, hasta } = query;

    const dateFilter: Prisma.DateTimeFilter = {};
    if (desde) dateFilter.gte = new Date(desde);
    if (hasta) dateFilter.lte = new Date(hasta);

    const packageWhere: Prisma.PackageWhereInput = {};
    if (desde || hasta) {
      packageWhere.creadoEn = dateFilter;
    }

    // 1. Total general y desglose por estado
    const [
      total,
      registrados,
      asignados,
      enRuta,
      entregados,
      fallidos,
      requierenRevision,
      repartidores,
      eventosEntregado,
    ] = await Promise.all([
      prisma.package.count({ where: packageWhere }),
      prisma.package.count({ where: { ...packageWhere, estado: 'REGISTRADO' } }),
      prisma.package.count({ where: { ...packageWhere, estado: 'ASIGNADO' } }),
      prisma.package.count({ where: { ...packageWhere, estado: 'EN_RUTA' } }),
      prisma.package.count({ where: { ...packageWhere, estado: 'ENTREGADO' } }),
      prisma.package.count({ where: { ...packageWhere, estado: 'FALLIDO' } }),
      prisma.package.count({
        where: {
          ...packageWhere,
          eventos: {
            some: { requiereRevision: true },
          },
        },
      }),
      prisma.user.findMany({
        where: { rol: 'REPARTIDOR' },
        select: {
          id: true,
          nombre: true,
          paquetes: {
            select: { estado: true },
          },
        },
      }),
      prisma.packageEvent.findMany({
        where: {
          tipo: 'ENTREGADO',
          ...(desde || hasta ? { ocurridoEn: dateFilter } : {}),
        },
        select: { ocurridoEn: true },
        orderBy: { ocurridoEn: 'asc' },
      }),
    ]);

    const porEstado: Record<PackageStatus, number> = {
      REGISTRADO: registrados,
      ASIGNADO: asignados,
      EN_RUTA: enRuta,
      ENTREGADO: entregados,
      FALLIDO: fallidos,
    };

    // 2. Métricas por repartidor
    const porRepartidor: RepartidorStatsDto[] = repartidores.map((rep) => {
      const ent = rep.paquetes.filter((p) => p.estado === 'ENTREGADO').length;
      const fal = rep.paquetes.filter((p) => p.estado === 'FALLIDO').length;
      return {
        repartidorId: rep.id,
        nombre: rep.nombre,
        entregados: ent,
        fallidos: fal,
      };
    });

    // 3. Entregados por día (agrupado por YYYY-MM-DD en UTC)
    const agrupadoPorDia: Record<string, number> = {};
    for (const evento of eventosEntregado) {
      const fecha = evento.ocurridoEn.toISOString().split('T')[0];
      agrupadoPorDia[fecha] = (agrupadoPorDia[fecha] || 0) + 1;
    }

    const entregadosPorDia: EntregasPorDiaDto[] = Object.entries(agrupadoPorDia).map(
      ([fecha, total]) => ({
        fecha,
        total,
      })
    );

    return {
      total,
      porEstado,
      requierenRevision,
      porRepartidor,
      entregadosPorDia,
    };
  }
}
