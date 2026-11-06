import { decideEvent } from './sync.logic';
import type { DecisionInput } from './sync.logic';

const ME = 'driver-1';
const OTHER = 'driver-2';
const t = (s: string) => new Date(`2026-10-30T${s}:00.000Z`);

const base = (over: Partial<DecisionInput> = {}): DecisionInput => ({
  tipo: 'EN_RUTA', ocurridoEn: t('10:00'), userId: ME,
  pkg: { estado: 'ASIGNADO', repartidorId: ME }, everAssigned: true, lastStateEventAt: t('08:00'), ...over,
});

describe('decideEvent', () => {
  it('rechaza si el chofer nunca tuvo el paquete', () => {
    expect(decideEvent(base({ everAssigned: false }))).toEqual({ accepted: false, reason: 'NOT_YOUR_PACKAGE' });
  });

  describe('ENTREGADO', () => {
    it('chofer asignado: pasa a ENTREGADO sin revisión', () => {
      expect(decideEvent(base({ tipo: 'ENTREGADO' }))).toEqual({ accepted: true, newEstado: 'ENTREGADO', requiereRevision: false });
    });
    it('chofer desasignado que entrega sin señal: se acepta y requiere revisión', () => {
      const d = decideEvent(base({ tipo: 'ENTREGADO', pkg: { estado: 'ASIGNADO', repartidorId: OTHER } }));
      expect(d).toEqual({ accepted: true, newEstado: 'ENTREGADO', requiereRevision: true });
    });
    it('se acepta aunque sea anterior al último evento de estado', () => {
      const d = decideEvent(base({ tipo: 'ENTREGADO', ocurridoEn: t('07:00') }));
      expect(d).toMatchObject({ newEstado: 'ENTREGADO', requiereRevision: false });
    });
    it('doble entrega: estado no cambia y requiere revisión', () => {
      const d = decideEvent(base({ tipo: 'ENTREGADO', pkg: { estado: 'ENTREGADO', repartidorId: ME } }));
      expect(d).toEqual({ accepted: true, newEstado: null, requiereRevision: true });
    });
  });

  describe('monotonía: un evento viejo nunca regresa un ENTREGADO', () => {
    const delivered = { estado: 'ENTREGADO' as const, repartidorId: ME };
    it('EN_RUTA tardío se guarda sin cambiar estado ni marcar', () => {
      expect(decideEvent(base({ tipo: 'EN_RUTA', pkg: delivered }))).toEqual({ accepted: true, newEstado: null, requiereRevision: false });
    });
    it('INTENTO_FALLIDO tardío no cambia estado y requiere revisión', () => {
      expect(decideEvent(base({ tipo: 'INTENTO_FALLIDO', pkg: delivered }))).toEqual({ accepted: true, newEstado: null, requiereRevision: true });
    });
  });

  describe('EN_RUTA / INTENTO_FALLIDO', () => {
    it('EN_RUTA más reciente del chofer asignado → EN_RUTA', () => {
      expect(decideEvent(base())).toEqual({ accepted: true, newEstado: 'EN_RUTA', requiereRevision: false });
    });
    it('INTENTO_FALLIDO más reciente → FALLIDO', () => {
      expect(decideEvent(base({ tipo: 'INTENTO_FALLIDO' }))).toEqual({ accepted: true, newEstado: 'FALLIDO', requiereRevision: false });
    });
    it('sin eventos de estado previos se aplica', () => {
      expect(decideEvent(base({ lastStateEventAt: null }))).toMatchObject({ newEstado: 'EN_RUTA' });
    });
    it('empate de ocurridoEn se aplica', () => {
      expect(decideEvent(base({ lastStateEventAt: t('10:00') }))).toMatchObject({ newEstado: 'EN_RUTA' });
    });
    it('evento más viejo que el último de estado no cambia el estado', () => {
      expect(decideEvent(base({ ocurridoEn: t('07:00') }))).toEqual({ accepted: true, newEstado: null, requiereRevision: false });
    });
    it('chofer desasignado: EN_RUTA se guarda sin cambiar estado', () => {
      const d = decideEvent(base({ pkg: { estado: 'ASIGNADO', repartidorId: OTHER } }));
      expect(d).toEqual({ accepted: true, newEstado: null, requiereRevision: false });
    });
    it('chofer desasignado: INTENTO_FALLIDO no cambia estado y requiere revisión', () => {
      const d = decideEvent(base({ tipo: 'INTENTO_FALLIDO', pkg: { estado: 'ASIGNADO', repartidorId: OTHER } }));
      expect(d).toEqual({ accepted: true, newEstado: null, requiereRevision: true });
    });
    it('paquete sin chofer actual (repartidorId null) trata al chofer como desasignado', () => {
      const d = decideEvent(base({ pkg: { estado: 'REGISTRADO', repartidorId: null } }));
      expect(d).toMatchObject({ newEstado: null });
    });
  });
});
