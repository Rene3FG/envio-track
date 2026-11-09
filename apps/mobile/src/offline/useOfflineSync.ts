/**
 * Cola offline de eventos de entrega para la app Expo (P5 la consume).
 *
 * Dependencias que debe instalar la app:
 *   npx expo install @react-native-async-storage/async-storage @react-native-community/netinfo expo-crypto
 * y en metro.config.js: watchFolders hacia packages/shared (importa @envio/shared).
 *
 * Uso:
 *   const { enqueue, syncNow, pendingCount, isSyncing, lastError } = useOfflineSync({
 *     apiBaseUrl: 'https://api.ejemplo.com',
 *     getAccessToken: async () => tokenStore.access,
 *     onRejected: (r) => Alert.alert('Evento rechazado', r.reason ?? ''),
 *   });
 *   await enqueue({ packageId, tipo: 'ENTREGADO', lat, lng, localPhotoUri: foto.uri });
 *   // enqueue lanza ZodError si el evento no cumple el contrato (ENTREGADO sin lat/lng/foto, FALLIDO sin motivo):
 *   // mostrar el error en pantalla y no dejar avanzar al chofer.
 *
 * Flujo de sincronización (docs/contrato-api.md §5-6):
 *   1. Sube las fotos locales pendientes a POST /upload y guarda la fotoUrl devuelta.
 *   2. Envía la cola en lotes de ≤100 a POST /sync.
 *   3. ACCEPTED, DUPLICATE y REJECTED salen de la cola (reintentar un REJECTED no sirve);
 *      los REJECTED se reportan por onRejected. Un error de red/5xx/401 deja todo en la cola.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { MAX_SYNC_BATCH, SyncEventDtoSchema } from '@envio/shared';
import type { SyncEventType, SyncResponse, SyncResult } from '@envio/shared';

export const QUEUE_KEY = '@droptrack_pending_sync';

export interface QueuedEvent {
  clientEventId: string;
  packageId: string;
  tipo: SyncEventType;
  ocurridoEn: string; // ISO UTC, momento real en la calle
  lat?: number;
  lng?: number;
  motivo?: string;
  /** Foto tomada offline; se sube antes de sincronizar y se reemplaza por fotoUrl. */
  localPhotoUri?: string;
  fotoUrl?: string;
}

export type NewQueuedEvent = Omit<QueuedEvent, 'clientEventId' | 'ocurridoEn'> & { ocurridoEn?: string };

export interface OfflineSyncOptions {
  apiBaseUrl: string;
  /** Debe devolver un access token VIGENTE (renovarlo con el refresh token antes de devolverlo). Ante un 401 la cola no reintenta: queda intacta y lastError lo indica. */
  getAccessToken: () => Promise<string | null>;
  onRejected?: (result: SyncResult) => void;
}

// ---------- Cola persistente (funciones puras sobre AsyncStorage) ----------

export async function readQueue(): Promise<QueuedEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedEvent[]) : [];
  } catch {
    return []; // JSON corrupto: no bloquear la app
  }
}

const writeQueue = (q: QueuedEvent[]): Promise<void> => AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));

// Serializa lecturas-modificaciones-escrituras para no perder eventos si enqueue y sync se solapan.
let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

export function enqueueEvent(input: NewQueuedEvent): Promise<QueuedEvent> {
  const event: QueuedEvent = { ...input, clientEventId: randomUUID(), ocurridoEn: input.ocurridoEn ?? new Date().toISOString() };
  // Valida contra el contrato antes de guardar: lanza ZodError si falta evidencia (ENTREGADO) o motivo
  // (INTENTO_FALLIDO). La foto local cuenta como evidencia pendiente de subir.
  const { localPhotoUri, ...rest } = event;
  SyncEventDtoSchema.parse({ ...rest, fotoUrl: rest.fotoUrl ?? (localPhotoUri ? '/uploads/pendiente.jpg' : undefined) });
  return withLock(async () => {
    await writeQueue([...(await readQueue()), event]);
    return event;
  });
}

const removeEvents = (ids: ReadonlySet<string>): Promise<void> =>
  withLock(async () => writeQueue((await readQueue()).filter((e) => !ids.has(e.clientEventId))));

const patchEvent = (id: string, patch: Partial<QueuedEvent>): Promise<void> =>
  withLock(async () => writeQueue((await readQueue()).map((e) => (e.clientEventId === id ? { ...e, ...patch } : e))));

// ---------- Red ----------

async function uploadPhoto(opts: OfflineSyncOptions, token: string, uri: string): Promise<string> {
  const form = new FormData();
  // React Native acepta { uri, name, type } como archivo en FormData.
  form.append('foto', { uri, name: 'evidencia.jpg', type: 'image/jpeg' } as unknown as Blob);
  const res = await fetch(`${opts.apiBaseUrl}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  if (!res.ok) throw new Error(`upload ${res.status}`);
  return ((await res.json()) as { fotoUrl: string }).fotoUrl;
}

async function postBatch(opts: OfflineSyncOptions, token: string, batch: QueuedEvent[]): Promise<SyncResponse> {
  const events = batch.map(({ localPhotoUri: _omit, ...e }) => e);
  const res = await fetch(`${opts.apiBaseUrl}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ events }),
  });
  if (!res.ok) throw new Error(`sync ${res.status}`);
  return (await res.json()) as SyncResponse;
}

/** Una pasada completa de sincronización. Devuelve cuántos eventos salieron de la cola. */
export async function flushQueue(opts: OfflineSyncOptions): Promise<number> {
  const token = await opts.getAccessToken();
  if (!token) throw new Error('Sin sesión');

  // 1) Fotos primero: el evento solo se manda cuando ya tiene fotoUrl.
  for (const ev of await readQueue()) {
    if (ev.localPhotoUri && !ev.fotoUrl) {
      const fotoUrl = await uploadPhoto(opts, token, ev.localPhotoUri);
      await patchEvent(ev.clientEventId, { fotoUrl, localPhotoUri: undefined });
    }
  }

  // 2) Eventos en lotes.
  let removed = 0;
  const queue = await readQueue();
  for (let i = 0; i < queue.length; i += MAX_SYNC_BATCH) {
    const { results } = await postBatch(opts, token, queue.slice(i, i + MAX_SYNC_BATCH));
    results.filter((r) => r.status === 'REJECTED').forEach((r) => opts.onRejected?.(r));
    const done = new Set(results.map((r) => r.clientEventId));
    await removeEvents(done);
    removed += done.size;
  }
  return removed;
}

// ---------- Hook ----------

export function useOfflineSync(opts: OfflineSyncOptions) {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const running = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const refresh = useCallback(async () => setPendingCount((await readQueue()).length), []);

  const syncNow = useCallback(async () => {
    if (running.current) return; // evita pasadas simultáneas
    running.current = true;
    setIsSyncing(true);
    try {
      await flushQueue(optsRef.current);
      setLastError(null);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : 'Error de sincronización');
    } finally {
      running.current = false;
      setIsSyncing(false);
      await refresh();
    }
  }, [refresh]);

  const enqueue = useCallback(
    async (input: NewQueuedEvent) => {
      const ev = await enqueueEvent(input);
      await refresh();
      const net = await NetInfo.fetch();
      if (net.isConnected && net.isInternetReachable !== false) void syncNow();
      return ev;
    },
    [refresh, syncNow],
  );

  useEffect(() => {
    void refresh();
    void syncNow();
    // Al volver la señal
    const unsubNet = NetInfo.addEventListener((s) => {
      if (s.isConnected && s.isInternetReachable !== false) void syncNow();
    });
    // Al volver la app a primer plano
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void syncNow();
    });
    return () => {
      unsubNet();
      sub.remove();
    };
  }, [refresh, syncNow]);

  return { enqueue, syncNow, pendingCount, isSyncing, lastError };
}
