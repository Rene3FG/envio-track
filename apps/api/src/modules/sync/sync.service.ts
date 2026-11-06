import { MAX_SYNC_BATCH, SyncEventDtoSchema } from '@envio/shared';
import type { PackageStatus, SyncEventDto, SyncResponse, SyncResult } from '@envio/shared';
import { decideEvent } from './sync.logic';

export class DuplicateEventError extends Error {
  constructor() {
    super('clientEventId duplicado');
  }
}

export interface NewEventRecord {
  clientEventId: string;
  packageId: string;
  userId: string;
  tipo: SyncEventDto['tipo'];
  ocurridoEn: Date;
  lat: number | null;
  lng: number | null;
  motivo: string | null;
  fotoUrl: string | null;
  requiereRevision: boolean;
}

/** Acceso a datos que necesita el servicio; lo implementa Prisma (ver sync.prisma-store.ts). */
export interface SyncStore {
  eventExists(clientEventId: string): Promise<boolean>;
  findPackage(id: string): Promise<{ id: string; estado: PackageStatus; repartidorId: string | null } | null>;
  wasEverAssigned(packageId: string, userId: string): Promise<boolean>;
  lastStateEventAt(packageId: string): Promise<Date | null>;
  /** Guarda el evento y, si newEstado no es null, actualiza el paquete: todo en una transacción. Lanza DuplicateEventError si el id ya existe. */
  saveEvent(record: NewEventRecord, newEstado: PackageStatus | null): Promise<void>;
}

export class BatchTooLargeError extends Error {
  constructor() {
    super(`El lote excede ${MAX_SYNC_BATCH} eventos`);
  }
}

const rejected = (clientEventId: string, reason: string): SyncResult => ({
  clientEventId, status: 'REJECTED', requiereRevision: false, packageEstado: null, reason,
});

/** Procesa un lote ordenado por ocurridoEn. Un evento malo no detiene al resto. */
export async function processSyncBatch(store: SyncStore, userId: string, rawEvents: unknown[]): Promise<SyncResponse> {
  if (rawEvents.length > MAX_SYNC_BATCH) throw new BatchTooLargeError();

  const parsed = rawEvents.map((raw) => {
    const r = SyncEventDtoSchema.safeParse(raw);
    return r.success ? { ok: true as const, ev: r.data } : { ok: false as const, raw };
  });

  // Orden estable por ocurridoEn; los malformados se quedan al final y salen REJECTED.
  const valid = parsed.flatMap((p) => (p.ok ? [p.ev] : []));
  valid.sort((a, b) => Date.parse(a.ocurridoEn) - Date.parse(b.ocurridoEn));

  const byId = new Map<string, SyncResult>();
  for (const ev of valid) byId.set(ev.clientEventId, await processOne(store, userId, ev));

  const results: SyncResult[] = parsed.map((p, i) => {
    if (!p.ok) {
      const id = (p.raw as { clientEventId?: unknown } | null)?.clientEventId;
      return rejected(typeof id === 'string' ? id : `index:${i}`, 'INVALID_EVENT');
    }
    return byId.get(p.ev.clientEventId) as SyncResult;
  });
  return { results };
}

async function processOne(store: SyncStore, userId: string, ev: SyncEventDto): Promise<SyncResult> {
  const pkg = await store.findPackage(ev.packageId);
  if (await store.eventExists(ev.clientEventId)) {
    return { clientEventId: ev.clientEventId, status: 'DUPLICATE', requiereRevision: false, packageEstado: pkg?.estado ?? null, reason: null };
  }
  if (!pkg) return rejected(ev.clientEventId, 'PACKAGE_NOT_FOUND');

  const decision = decideEvent({
    tipo: ev.tipo,
    ocurridoEn: new Date(ev.ocurridoEn),
    userId,
    pkg,
    everAssigned: pkg.repartidorId === userId || (await store.wasEverAssigned(pkg.id, userId)),
    lastStateEventAt: await store.lastStateEventAt(pkg.id),
  });
  if (!decision.accepted) return rejected(ev.clientEventId, decision.reason);

  try {
    await store.saveEvent(
      {
        clientEventId: ev.clientEventId, packageId: ev.packageId, userId, tipo: ev.tipo,
        ocurridoEn: new Date(ev.ocurridoEn), lat: ev.lat ?? null, lng: ev.lng ?? null,
        motivo: ev.motivo ?? null, fotoUrl: ev.fotoUrl ?? null, requiereRevision: decision.requiereRevision,
      },
      decision.newEstado,
    );
  } catch (err) {
    if (err instanceof DuplicateEventError) {
      return { clientEventId: ev.clientEventId, status: 'DUPLICATE', requiereRevision: false, packageEstado: pkg.estado, reason: null };
    }
    throw err;
  }
  return {
    clientEventId: ev.clientEventId, status: 'ACCEPTED', requiereRevision: decision.requiereRevision,
    packageEstado: decision.newEstado ?? pkg.estado, reason: null,
  };
}
