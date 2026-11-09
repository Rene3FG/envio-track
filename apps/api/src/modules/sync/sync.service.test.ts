import { BatchTooLargeError, DuplicateEventError, processSyncBatch } from './sync.service';
import type { NewEventRecord, SyncStore } from './sync.service';
import type { PackageStatus } from '@envio/shared';

const ME = 'driver-1';
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PKG = U(100);

interface FakePkg { estado: PackageStatus; repartidorId: string | null }

/** Store en memoria que replica las reglas de datos de Prisma. */
function fakeStore(pkgs: Record<string, FakePkg>, assigned: Array<[string, string]> = []) {
  const events: Array<NewEventRecord & { newEstado: PackageStatus | null }> = [];
  const store: SyncStore = {
    eventExists: async (id) => events.some((e) => e.clientEventId === id),
    findPackage: async (id) => (pkgs[id] ? { id, ...pkgs[id] } : null),
    wasEverAssigned: async (p, u) => assigned.some(([ap, au]) => ap === p && au === u),
    lastStateEventAt: async (p) => {
      const dates = events.filter((e) => e.packageId === p).map((e) => e.ocurridoEn.getTime());
      return dates.length ? new Date(Math.max(...dates)) : null;
    },
    saveEvent: async (record, newEstado) => {
      if (events.some((e) => e.clientEventId === record.clientEventId)) throw new DuplicateEventError();
      events.push({ ...record, newEstado });
      if (newEstado) (pkgs[record.packageId] as FakePkg).estado = newEstado;
    },
  };
  return { store, events, pkgs };
}

const ev = (n: number, tipo: string, time: string, extra: object = {}) => ({
  clientEventId: U(n), packageId: PKG, tipo, ocurridoEn: `2026-10-30T${time}:00.000Z`,
  ...(tipo === 'ENTREGADO' ? { lat: 17.06, lng: -96.72, fotoUrl: '/uploads/e.jpg' } : {}),
  ...extra,
});

describe('processSyncBatch', () => {
  it('acepta un lote y lo procesa por ocurridoEn, no por llegada', async () => {
    const { store, events, pkgs } = fakeStore({ [PKG]: { estado: 'ASIGNADO', repartidorId: ME } });
    // Llega primero la entrega (12:00) y luego el EN_RUTA (10:00)
    const { results } = await processSyncBatch(store, ME, [ev(1, 'ENTREGADO', '12:00'), ev(2, 'EN_RUTA', '10:00')]);
    expect(events.map((e) => e.tipo)).toEqual(['EN_RUTA', 'ENTREGADO']);
    expect(pkgs[PKG]?.estado).toBe('ENTREGADO');
    expect(results.map((r) => r.status)).toEqual(['ACCEPTED', 'ACCEPTED']); // respeta el orden de la petición
    expect(results[0]?.packageEstado).toBe('ENTREGADO');
  });

  it('es idempotente: reenviar el mismo lote da DUPLICATE y no duplica filas', async () => {
    const { store, events } = fakeStore({ [PKG]: { estado: 'ASIGNADO', repartidorId: ME } });
    const batch = [ev(1, 'EN_RUTA', '10:00')];
    await processSyncBatch(store, ME, batch);
    const second = await processSyncBatch(store, ME, batch);
    expect(second.results[0]).toMatchObject({ status: 'DUPLICATE', reason: null });
    expect(events).toHaveLength(1);
  });

  it('DUPLICATE también cuando el paquete ya no existe', async () => {
    const { store, events } = fakeStore({});
    events.push({
      clientEventId: U(1), packageId: PKG, userId: ME, tipo: 'EN_RUTA', ocurridoEn: new Date(), lat: null, lng: null,
      motivo: null, fotoUrl: null, requiereRevision: false, newEstado: null,
    });
    const { results } = await processSyncBatch(store, ME, [ev(1, 'EN_RUTA', '10:00')]);
    expect(results[0]).toMatchObject({ status: 'DUPLICATE', packageEstado: null });
  });

  it('carrera de duplicado al guardar → DUPLICATE', async () => {
    const { store } = fakeStore({ [PKG]: { estado: 'ASIGNADO', repartidorId: ME } });
    store.saveEvent = async () => { throw new DuplicateEventError(); };
    const { results } = await processSyncBatch(store, ME, [ev(1, 'EN_RUTA', '10:00')]);
    expect(results[0]).toMatchObject({ status: 'DUPLICATE', packageEstado: 'ASIGNADO' });
  });

  it('propaga errores inesperados del store', async () => {
    const { store } = fakeStore({ [PKG]: { estado: 'ASIGNADO', repartidorId: ME } });
    store.saveEvent = async () => { throw new Error('db caída'); };
    await expect(processSyncBatch(store, ME, [ev(1, 'EN_RUTA', '10:00')])).rejects.toThrow('db caída');
  });

  it('un evento viejo jamás regresa un paquete ENTREGADO', async () => {
    const { store, pkgs } = fakeStore({ [PKG]: { estado: 'ENTREGADO', repartidorId: ME } });
    const { results } = await processSyncBatch(store, ME, [ev(1, 'EN_RUTA', '09:00')]);
    expect(results[0]).toMatchObject({ status: 'ACCEPTED', packageEstado: 'ENTREGADO', requiereRevision: false });
    expect(pkgs[PKG]?.estado).toBe('ENTREGADO');
  });

  it('chofer desasignado que entrega sin señal: ACCEPTED con requiereRevision', async () => {
    const { store, events, pkgs } = fakeStore({ [PKG]: { estado: 'ASIGNADO', repartidorId: 'driver-2' } }, [[PKG, ME]]);
    const { results } = await processSyncBatch(store, ME, [ev(1, 'ENTREGADO', '11:00', { lat: 17.06, lng: -96.72 })]);
    expect(results[0]).toMatchObject({ status: 'ACCEPTED', requiereRevision: true, packageEstado: 'ENTREGADO' });
    expect(events[0]).toMatchObject({ requiereRevision: true, lat: 17.06, lng: -96.72, userId: ME });
    expect(pkgs[PKG]?.estado).toBe('ENTREGADO');
  });

  it('rechaza paquetes que el chofer nunca tuvo', async () => {
    const { store, events } = fakeStore({ [PKG]: { estado: 'ASIGNADO', repartidorId: 'driver-2' } });
    const { results } = await processSyncBatch(store, ME, [ev(1, 'ENTREGADO', '11:00')]);
    expect(results[0]).toMatchObject({ status: 'REJECTED', reason: 'NOT_YOUR_PACKAGE' });
    expect(events).toHaveLength(0);
  });

  it('rechaza paquete inexistente sin frenar el resto del lote', async () => {
    const { store, events } = fakeStore({ [PKG]: { estado: 'ASIGNADO', repartidorId: ME } });
    const ghost = { ...ev(1, 'EN_RUTA', '09:00'), packageId: U(999) };
    const { results } = await processSyncBatch(store, ME, [ghost, ev(2, 'EN_RUTA', '10:00')]);
    expect(results.map((r) => [r.status, r.reason])).toEqual([['REJECTED', 'PACKAGE_NOT_FOUND'], ['ACCEPTED', null]]);
    expect(events).toHaveLength(1);
  });

  it('eventos malformados salen REJECTED/INVALID_EVENT en su posición, con o sin clientEventId', async () => {
    const { store } = fakeStore({ [PKG]: { estado: 'ASIGNADO', repartidorId: ME } });
    const { results } = await processSyncBatch(store, ME, [
      ev(1, 'INTENTO_FALLIDO', '09:00'), // sin motivo
      null,
      ev(2, 'EN_RUTA', '10:00'),
    ]);
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ clientEventId: U(1), status: 'REJECTED', reason: 'INVALID_EVENT' });
    expect(results[1]).toMatchObject({ clientEventId: 'index:1', status: 'REJECTED', reason: 'INVALID_EVENT' });
    expect(results[2]?.status).toBe('ACCEPTED');
  });

  it('INTENTO_FALLIDO con motivo guarda el motivo y pasa a FALLIDO', async () => {
    const { store, events } = fakeStore({ [PKG]: { estado: 'EN_RUTA', repartidorId: ME } });
    const { results } = await processSyncBatch(store, ME, [ev(1, 'INTENTO_FALLIDO', '10:00', { motivo: 'Nadie en casa', fotoUrl: '/uploads/a.jpg' })]);
    expect(results[0]).toMatchObject({ status: 'ACCEPTED', packageEstado: 'FALLIDO' });
    expect(events[0]).toMatchObject({ motivo: 'Nadie en casa', fotoUrl: '/uploads/a.jpg' });
  });

  it('lote de más de 100 → BatchTooLargeError', async () => {
    const { store } = fakeStore({});
    await expect(processSyncBatch(store, ME, Array(101).fill({}))).rejects.toBeInstanceOf(BatchTooLargeError);
  });
});
