export type PackageStatus = 'REGISTRADO' | 'ASIGNADO' | 'EN_RUTA' | 'ENTREGADO' | 'FALLIDO';

export interface PackageEvent {
  tipo: 'CREADO' | 'ASIGNADO' | 'EN_RUTA' | 'ENTREGADO' | 'FALLIDO';
  ocurridoEn: string;
  detalle: string;
  motivo?: string;
  firma?: boolean;
  foto?: boolean;
}

export interface DriverItem {
  id: string;
  nombre: string;
  unidad: string;
  tipo: 'EV' | 'VAN' | 'MOTO' | 'CAMION';
  telefono: string;
  activo: boolean;
  paquetesAsignados: number;
  bateria?: number;
  zona: string;
}

export interface PackageRecord {
  id: string;
  guia: string;
  destinatario: string;
  telefonoDestinatario: string;
  direccion: string;
  zona: string;
  lat: number;
  lng: number;
  urgente: boolean;
  estado: PackageStatus;
  repartidor: { id: string; nombre: string; unidad?: string } | null;
  requiereRevision: boolean;
  creadoEn: string;
  actualizadoEn: string;
  eta: string;
  progreso: number;
  notas?: string;
  eventos: PackageEvent[];
}
