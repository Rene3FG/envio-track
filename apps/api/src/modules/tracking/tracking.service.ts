import { prisma } from '../../config/prisma';
import { AppError } from '../../errors/app-error';
import { TrackDto } from './tracking.dto';

export class TrackingService {
  private maskDestinatario(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return 'Destinatario';

    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      const first = parts[0];
      return `${first.charAt(0).toUpperCase()}. ***`;
    }

    const firstInitial = `${parts[0].charAt(0).toUpperCase()}.`;
    const lastInitial = parts[1].charAt(0).toUpperCase();

    return `${firstInitial} ${lastInitial}***`;
  }

  async trackByGuia(guia: string): Promise<TrackDto> {
    const formattedGuia = guia.trim().toUpperCase();

    const pkg = await prisma.package.findUnique({
      where: { guia: formattedGuia },
      include: {
        eventos: {
          orderBy: { ocurridoEn: 'asc' },
        },
      },
    });

    if (!pkg) {
      throw AppError.notFound('No se encontró ningún paquete con la guía proporcionada');
    }

    return {
      guia: pkg.guia,
      estado: pkg.estado,
      destinatario: this.maskDestinatario(pkg.destinatario),
      eventos: pkg.eventos.map((e) => ({
        tipo: e.tipo,
        ocurridoEn: e.ocurridoEn,
        lat: e.lat,
        lng: e.lng,
        fotoUrl: e.fotoUrl,
        motivo: e.motivo,
      })),
    };
  }
}
