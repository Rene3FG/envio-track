import { PackageStatus, EventType } from '@prisma/client';

export interface PublicTrackEventDto {
  tipo: EventType;
  ocurridoEn: Date;
  lat: number | null;
  lng: number | null;
  fotoUrl: string | null;
  motivo: string | null;
}

export interface TrackDto {
  guia: string;
  estado: PackageStatus;
  destinatario: string;
  eventos: PublicTrackEventDto[];
}
