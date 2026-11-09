import {
  FotoUrlSchema, PackageEventDtoSchema, TrackDtoSchema, LatSchema, LngSchema, MEXICO_BOUNDS, CreatePackageDtoSchema, CreateUserDtoSchema, LoginDtoSchema, PackageListQuerySchema, PaginationQuerySchema,
  SyncEventDtoSchema, SyncRequestSchema, UpdatePackageDtoSchema, UpdateUserDtoSchema, UserListQuerySchema, paginated,
} from './schemas';
import { z } from 'zod';

const uuid = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';
const uuid2 = '4f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6c';
const baseEvent = { clientEventId: uuid, packageId: uuid2, tipo: 'EN_RUTA', ocurridoEn: '2026-10-30T15:00:00.000Z' };
const evidence = { lat: 17.06, lng: -96.72, fotoUrl: '/uploads/a.jpg' };

describe('SyncEventDtoSchema', () => {
  it('acepta un ENTREGADO con evidencia completa', () => {
    expect(SyncEventDtoSchema.safeParse({ ...baseEvent, tipo: 'ENTREGADO', ...evidence }).success).toBe(true);
  });
  it.each(['lat', 'lng', 'fotoUrl'])('ENTREGADO sin %s se rechaza', (campo) => {
    const rest: Record<string, unknown> = { ...evidence };
    delete rest[campo];
    const r = SyncEventDtoSchema.safeParse({ ...baseEvent, tipo: 'ENTREGADO', ...rest });
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => i.path[0])).toEqual([campo]);
  });
  it('EN_RUTA no exige evidencia', () => {
    expect(SyncEventDtoSchema.safeParse(baseEvent).success).toBe(true);
  });
  it('exige motivo en INTENTO_FALLIDO', () => {
    const r = SyncEventDtoSchema.safeParse({ ...baseEvent, tipo: 'INTENTO_FALLIDO' });
    expect(r.success).toBe(false);
    expect(r.success ? '' : r.error.issues[0]?.path).toEqual(['motivo']);
  });
  it('acepta INTENTO_FALLIDO con motivo', () => {
    expect(SyncEventDtoSchema.safeParse({ ...baseEvent, tipo: 'INTENTO_FALLIDO', motivo: 'Nadie en casa' }).success).toBe(true);
  });
  it('rechaza tipos que el repartidor no puede mandar', () => {
    expect(SyncEventDtoSchema.safeParse({ ...baseEvent, tipo: 'CREADO' }).success).toBe(false);
    expect(SyncEventDtoSchema.safeParse({ ...baseEvent, tipo: 'ASIGNADO' }).success).toBe(false);
  });
  it('rechaza coordenadas fuera de rango, ids no uuid y fechas no ISO', () => {
    expect(SyncEventDtoSchema.safeParse({ ...baseEvent, lat: 91 }).success).toBe(false);
    expect(SyncEventDtoSchema.safeParse({ ...baseEvent, lng: -181 }).success).toBe(false);
    expect(SyncEventDtoSchema.safeParse({ ...baseEvent, clientEventId: 'x' }).success).toBe(false);
    expect(SyncEventDtoSchema.safeParse({ ...baseEvent, ocurridoEn: 'ayer' }).success).toBe(false);
  });
  it('rechaza HTML en el motivo', () => {
    expect(SyncEventDtoSchema.safeParse({ ...baseEvent, tipo: 'INTENTO_FALLIDO', motivo: '<script>x</script>' }).success).toBe(false);
  });
});

describe('SyncRequestSchema', () => {
  it('rechaza lote vacío y de más de 100', () => {
    expect(SyncRequestSchema.safeParse({ events: [] }).success).toBe(false);
    expect(SyncRequestSchema.safeParse({ events: Array(101).fill({}) }).success).toBe(false);
    expect(SyncRequestSchema.safeParse({ events: Array(100).fill({}) }).success).toBe(true);
  });
});

describe('Paquetes', () => {
  const pkg = { destinatario: '  Juan  ', direccion: 'Calle 1', lat: 17.06, lng: -96.72 };
  it('recorta texto y exige lat/lng', () => {
    expect(CreatePackageDtoSchema.parse(pkg).destinatario).toBe('Juan');
    expect(CreatePackageDtoSchema.safeParse({ destinatario: 'a', direccion: 'b' }).success).toBe(false);
  });
  it('rechaza teléfono inválido y HTML', () => {
    expect(CreatePackageDtoSchema.safeParse({ ...pkg, telefonoDestinatario: 'abc' }).success).toBe(false);
    expect(CreatePackageDtoSchema.safeParse({ ...pkg, direccion: '<b>x</b>' }).success).toBe(false);
  });
  it('UpdatePackageDto es parcial', () => {
    expect(UpdatePackageDtoSchema.safeParse({}).success).toBe(true);
    expect(UpdatePackageDtoSchema.safeParse({ lat: 100 }).success).toBe(false);
  });
  it('convierte filtros de query', () => {
    const q = PackageListQuerySchema.parse({ requiereRevision: 'true', page: '2' });
    expect(q.requiereRevision).toBe(true);
    expect(q.page).toBe(2);
    expect(q.pageSize).toBe(20);
  });
});

describe('Usuarios, auth y paginación', () => {
  it('normaliza el email y exige contraseña de 8+', () => {
    expect(LoginDtoSchema.parse({ email: ' A@B.COM ', password: 'x' }).email).toBe('a@b.com');
    expect(CreateUserDtoSchema.safeParse({ nombre: 'A', email: 'a@b.com', password: '1234567', rol: 'ADMIN' }).success).toBe(false);
    expect(CreateUserDtoSchema.safeParse({ nombre: 'A', email: 'a@b.com', password: '12345678', rol: 'ADMIN' }).success).toBe(true);
  });
  it('UpdateUserDto es parcial y UserListQuery convierte activo', () => {
    expect(UpdateUserDtoSchema.safeParse({ activo: false }).success).toBe(true);
    expect(UserListQuerySchema.parse({ activo: 'false' }).activo).toBe(false);
  });
  it('limita pageSize a 100 y arma respuestas paginadas', () => {
    expect(PaginationQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
    const schema = paginated(z.string());
    expect(schema.safeParse({ data: ['a'], page: 1, pageSize: 20, total: 1 }).success).toBe(true);
  });
});

describe('Coordenadas limitadas a México', () => {
  it('acepta Oaxaca, CDMX, Tijuana y Cancún', () => {
    for (const [lat, lng] of [[17.06, -96.72], [19.43, -99.13], [32.5, -117.0], [21.16, -86.85]] as const) {
      expect(LatSchema.safeParse(lat).success && LngSchema.safeParse(lng).success).toBe(true);
    }
  });
  it('acepta los bordes y rechaza lo que está justo fuera', () => {
    expect(LatSchema.safeParse(MEXICO_BOUNDS.latMin).success).toBe(true);
    expect(LatSchema.safeParse(MEXICO_BOUNDS.latMax).success).toBe(true);
    expect(LatSchema.safeParse(MEXICO_BOUNDS.latMax + 0.01).success).toBe(false);
    expect(LngSchema.safeParse(MEXICO_BOUNDS.lngMin - 0.01).success).toBe(false);
  });
  it('rechaza Madrid y Nueva York al crear un paquete', () => {
    const pkg = { destinatario: 'A', direccion: 'B' };
    expect(CreatePackageDtoSchema.safeParse({ ...pkg, lat: 40.4, lng: -3.7 }).success).toBe(false);
    expect(CreatePackageDtoSchema.safeParse({ ...pkg, lat: 40.7, lng: -74.0 }).success).toBe(false);
  });
});

describe('FotoUrlSchema', () => {
  it.each(['/uploads/abc123.jpg', '/uploads/a-b_c.png', '/uploads/x.jpeg'])('acepta %s', (u) => {
    expect(FotoUrlSchema.safeParse(u).success).toBe(true);
  });
  it.each([
    'https://evil.com/a.jpg', '//evil.com/a.jpg', '/uploads/../etc/passwd.jpg', '/uploads/a.gif',
    'javascript:alert(1)', '/uploads/a.jpg?x=1', '/uploads/', '/otra/a.jpg',
  ])('rechaza %s', (u) => {
    expect(FotoUrlSchema.safeParse(u).success).toBe(false);
  });
  it('SyncEventDto rechaza fotoUrl externa', () => {
    expect(SyncEventDtoSchema.safeParse({ ...baseEvent, fotoUrl: 'https://evil.com/a.jpg' }).success).toBe(false);
  });
});

describe('Respuestas con fotoUrl', () => {
  const ev = { tipo: 'ENTREGADO', ocurridoEn: '2026-10-30T15:00:00.000Z', lat: 17.06, lng: -96.72, motivo: null };
  it('PackageEventDto acepta ruta de /uploads o null y rechaza URL externa', () => {
    const full = { ...ev, id: uuid, requiereRevision: false };
    expect(PackageEventDtoSchema.safeParse({ ...full, fotoUrl: '/uploads/a.jpg' }).success).toBe(true);
    expect(PackageEventDtoSchema.safeParse({ ...full, fotoUrl: null }).success).toBe(true);
    expect(PackageEventDtoSchema.safeParse({ ...full, fotoUrl: 'https://x.com/a.jpg' }).success).toBe(false);
  });
  it('TrackDto rechaza fotoUrl externa', () => {
    const track = (fotoUrl: string | null) => ({ guia: 'ET-104920', estado: 'ENTREGADO', destinatario: 'J. P***', eventos: [{ ...ev, fotoUrl }] });
    expect(TrackDtoSchema.safeParse(track('/uploads/a.jpg')).success).toBe(true);
    expect(TrackDtoSchema.safeParse(track('javascript:alert(1)')).success).toBe(false);
  });
});
