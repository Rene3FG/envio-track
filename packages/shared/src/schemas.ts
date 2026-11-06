import { z } from 'zod';

// ---------- Enums (espejo de apps/api/prisma/schema.prisma) ----------
export const RoleSchema = z.enum(['ADMIN', 'REPARTIDOR']);
export const PackageStatusSchema = z.enum(['REGISTRADO', 'ASIGNADO', 'EN_RUTA', 'ENTREGADO', 'FALLIDO']);
export const EventTypeSchema = z.enum(['CREADO', 'ASIGNADO', 'EN_RUTA', 'ENTREGADO', 'INTENTO_FALLIDO']);
/** Eventos que un repartidor puede mandar a /sync. */
export const SyncEventTypeSchema = z.enum(['EN_RUTA', 'ENTREGADO', 'INTENTO_FALLIDO']);

// ---------- Primitivos reutilizables ----------
/** Rectángulo que cubre México: detecta clics de mapa fuera del país. */
export const MEXICO_BOUNDS = { latMin: 14.5, latMax: 32.8, lngMin: -118.5, lngMax: -86.5 } as const;
export const LatSchema = z.number().min(MEXICO_BOUNDS.latMin).max(MEXICO_BOUNDS.latMax);
export const LngSchema = z.number().min(MEXICO_BOUNDS.lngMin).max(MEXICO_BOUNDS.lngMax);
const uuid = z.string().uuid();
/** Solo rutas que genera POST /upload: /uploads/<nombre-aleatorio>.jpg|jpeg|png (sin URLs externas ni `..`). */
export const FotoUrlSchema = z.string().regex(/^\/uploads\/[A-Za-z0-9_-]{1,100}\.(jpg|jpeg|png)$/, 'fotoUrl inválida');
const isoDate = z.string().datetime();
/** Texto libre: recortado, acotado y sin etiquetas HTML. */
const safeText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((v) => !/[<>]/.test(v), { message: 'No se permite HTML' });

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const paginated = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ data: z.array(item), page: z.number().int(), pageSize: z.number().int(), total: z.number().int() });

// ---------- Error ----------
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.enum([
      'VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT',
      'PAYLOAD_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', 'RATE_LIMITED', 'INTERNAL',
    ]),
    message: z.string(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});

// ---------- Auth / Usuarios ----------
export const UserDtoSchema = z.object({
  id: uuid,
  nombre: z.string(),
  email: z.string().email(),
  rol: RoleSchema,
  activo: z.boolean(),
  creadoEn: isoDate,
});
export const LoginDtoSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });
export const RefreshDtoSchema = z.object({ refreshToken: z.string().min(1) });
export const LoginResponseSchema = z.object({ accessToken: z.string(), refreshToken: z.string(), user: UserDtoSchema });
export const TokenPairSchema = z.object({ accessToken: z.string(), refreshToken: z.string() });

export const CreateUserDtoSchema = z.object({
  nombre: safeText(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
  rol: RoleSchema,
});
export const UpdateUserDtoSchema = z
  .object({
    nombre: safeText(100),
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(8).max(128),
    activo: z.boolean(),
  })
  .partial();
export const UserListQuerySchema = PaginationQuerySchema.extend({
  rol: RoleSchema.optional(),
  activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

// ---------- Paquetes ----------
export const PackageEventDtoSchema = z.object({
  id: uuid,
  tipo: EventTypeSchema,
  ocurridoEn: isoDate,
  lat: LatSchema.nullable(),
  lng: LngSchema.nullable(),
  fotoUrl: FotoUrlSchema.nullable(),
  motivo: z.string().nullable(),
  requiereRevision: z.boolean(),
});
export const PackageDtoSchema = z.object({
  id: uuid,
  guia: z.string(),
  destinatario: z.string(),
  telefonoDestinatario: z.string().nullable(),
  direccion: z.string(),
  referencias: z.string().nullable(),
  lat: LatSchema,
  lng: LngSchema,
  urgente: z.boolean(),
  estado: PackageStatusSchema,
  repartidor: z.object({ id: uuid, nombre: z.string() }).nullable(),
  creadoEn: isoDate,
  actualizadoEn: isoDate,
});
export const PackageDetailDtoSchema = PackageDtoSchema.extend({ eventos: z.array(PackageEventDtoSchema) });

export const CreatePackageDtoSchema = z.object({
  destinatario: safeText(120),
  telefonoDestinatario: z.string().trim().regex(/^[0-9+\-\s()]{7,20}$/).optional(),
  direccion: safeText(250),
  referencias: safeText(250).optional(),
  lat: LatSchema,
  lng: LngSchema,
  urgente: z.boolean().optional(),
});
export const UpdatePackageDtoSchema = CreatePackageDtoSchema.omit({ destinatario: true, telefonoDestinatario: true })
  .partial();
export const AssignPackageDtoSchema = z.object({ repartidorId: uuid });
export const PackageListQuerySchema = PaginationQuerySchema.extend({
  estado: PackageStatusSchema.optional(),
  repartidorId: uuid.optional(),
  requiereRevision: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  q: z.string().trim().max(100).optional(),
});

// ---------- Sync ----------
export const MAX_SYNC_BATCH = 100;

export const SyncEventDtoSchema = z
  .object({
    clientEventId: uuid,
    packageId: uuid,
    tipo: SyncEventTypeSchema,
    ocurridoEn: isoDate,
    lat: LatSchema.optional(),
    lng: LngSchema.optional(),
    motivo: safeText(250).optional(),
    fotoUrl: FotoUrlSchema.optional(),
  })
  .superRefine((ev, ctx) => {
    if (ev.tipo === 'INTENTO_FALLIDO' && !ev.motivo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivo'], message: 'Obligatorio en INTENTO_FALLIDO' });
    }
    if (ev.tipo === 'ENTREGADO') {
      for (const campo of ['lat', 'lng', 'fotoUrl'] as const) {
        if (ev[campo] === undefined) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: 'Obligatorio en ENTREGADO (evidencia)' });
        }
      }
    }
  });

export const SyncRequestSchema = z.object({
  events: z.array(z.unknown()).min(1).max(MAX_SYNC_BATCH),
});

export const SyncStatusSchema = z.enum(['ACCEPTED', 'DUPLICATE', 'REJECTED']);
export const SyncResultSchema = z.object({
  clientEventId: z.string(),
  status: SyncStatusSchema,
  requiereRevision: z.boolean(),
  packageEstado: PackageStatusSchema.nullable(),
  reason: z.string().nullable(),
});
export const SyncResponseSchema = z.object({ results: z.array(SyncResultSchema) });

// ---------- Rastreo público / Estadísticas ----------
export const TrackDtoSchema = z.object({
  guia: z.string(),
  estado: PackageStatusSchema,
  destinatario: z.string(),
  eventos: z.array(
    z.object({
      tipo: EventTypeSchema,
      ocurridoEn: isoDate,
      lat: LatSchema.nullable(),
      lng: LngSchema.nullable(),
      fotoUrl: FotoUrlSchema.nullable(),
      motivo: z.string().nullable(),
    }),
  ),
});
export const StatsQuerySchema = z.object({ desde: isoDate.optional(), hasta: isoDate.optional() });
export const StatsDtoSchema = z.object({
  total: z.number().int(),
  porEstado: z.record(PackageStatusSchema, z.number().int()),
  requierenRevision: z.number().int(),
  porRepartidor: z.array(z.object({ repartidorId: uuid, nombre: z.string(), entregados: z.number().int(), fallidos: z.number().int() })),
  entregadosPorDia: z.array(z.object({ fecha: z.string(), total: z.number().int() })),
});
