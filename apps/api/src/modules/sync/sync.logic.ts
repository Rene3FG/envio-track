import type { PackageStatus, SyncEventType } from '@envio/shared';

export interface DecisionInput {
  tipo: SyncEventType;
  ocurridoEn: Date;
  userId: string;
  pkg: { estado: PackageStatus; repartidorId: string | null };
  /** El chofer tiene (o tuvo) el paquete asignado según el historial. */
  everAssigned: boolean;
  /** ocurridoEn del último evento que cambió el estado del paquete (null si no hay). */
  lastStateEventAt: Date | null;
}

export type Decision =
  | { accepted: false; reason: 'NOT_YOUR_PACKAGE' }
  | { accepted: true; newEstado: PackageStatus | null; requiereRevision: boolean };

const TARGET_STATE: Record<SyncEventType, PackageStatus> = {
  EN_RUTA: 'EN_RUTA',
  ENTREGADO: 'ENTREGADO',
  INTENTO_FALLIDO: 'FALLIDO',
};

/**
 * Máquina de estados monótona. Reglas (docs/contrato-api.md §5 y §9):
 *  - Chofer que nunca tuvo el paquete → rechazado.
 *  - ENTREGADO es terminal: ningún evento posterior mueve el estado.
 *  - ENTREGADO se acepta siempre (la realidad en campo manda); se marca para revisión si
 *    el chofer ya no es el asignado o el paquete ya estaba ENTREGADO (doble entrega).
 *  - EN_RUTA / INTENTO_FALLIDO solo cambian el estado si son más recientes (por ocurridoEn) que el último
 *    evento de estado y vienen del chofer asignado; si no, se guardan sin tocar el estado.
 *  - Un INTENTO_FALLIDO que contradice una entrega, o de un chofer ya desasignado, se marca para revisión.
 */
export function decideEvent(input: DecisionInput): Decision {
  const { tipo, ocurridoEn, userId, pkg, everAssigned, lastStateEventAt } = input;
  if (!everAssigned) return { accepted: false, reason: 'NOT_YOUR_PACKAGE' };

  const isCurrentDriver = pkg.repartidorId === userId;
  const alreadyDelivered = pkg.estado === 'ENTREGADO';

  if (tipo === 'ENTREGADO') {
    return {
      accepted: true,
      newEstado: alreadyDelivered ? null : 'ENTREGADO',
      requiereRevision: alreadyDelivered || !isCurrentDriver,
    };
  }

  if (alreadyDelivered) {
    return { accepted: true, newEstado: null, requiereRevision: tipo === 'INTENTO_FALLIDO' };
  }

  const isNewest = lastStateEventAt === null || ocurridoEn >= lastStateEventAt;
  const canApply = isCurrentDriver && isNewest;
  return {
    accepted: true,
    newEstado: canApply ? TARGET_STATE[tipo] : null,
    requiereRevision: tipo === 'INTENTO_FALLIDO' && !isCurrentDriver,
  };
}
