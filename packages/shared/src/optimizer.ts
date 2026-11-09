export interface GeoPoint {
  lat: number;
  lng: number;
}
export interface RouteStop extends GeoPoint {
  id: string;
}

/**
 * Punto de partida fijo de toda ruta (almacén). PROVISIONAL: Zócalo de Oaxaca; reemplazar por las
 * coordenadas reales del almacén. Debe quedar dentro de MEXICO_BOUNDS.
 */
export const DEPOT: Readonly<GeoPoint> = { lat: 17.0609, lng: -96.7254 };

const EARTH_RADIUS_KM = 6371.0088;
const EPSILON = 1e-9;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

function assertPoint(p: GeoPoint): void {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) {
    throw new RangeError(`Coordenada inválida: (${p.lat}, ${p.lng})`);
  }
}

/** Distancia de gran círculo en km entre dos coordenadas (fórmula de Haversine). */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  assertPoint(a);
  assertPoint(b);
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Longitud del recorrido abierto origen → paradas en el orden dado. */
export function routeDistanceKm(origin: GeoPoint, stops: readonly RouteStop[]): number {
  let total = 0;
  let prev: GeoPoint = origin;
  for (const stop of stops) {
    total += haversineKm(prev, stop);
    prev = stop;
  }
  return total;
}

/** Vecino más cercano: siempre va a la parada pendiente más próxima. No muta la entrada. */
export function nearestNeighbor(origin: GeoPoint, stops: readonly RouteStop[]): RouteStop[] {
  const pending = [...stops];
  const ordered: RouteStop[] = [];
  let current: GeoPoint = origin;
  while (pending.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    pending.forEach((stop, idx) => {
      const d = haversineKm(current, stop);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    });
    const [next] = pending.splice(bestIdx, 1) as [RouteStop];
    ordered.push(next);
    current = next;
  }
  return ordered;
}

/**
 * 2-opt sobre un recorrido abierto con origen fijo: invierte tramos mientras acorten la ruta.
 * No muta la entrada.
 */
export function twoOpt(origin: GeoPoint, stops: readonly RouteStop[]): RouteStop[] {
  const route = [...stops];
  const n = route.length;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const prev: GeoPoint = i === 0 ? origin : (route[i - 1] as RouteStop);
        const first = route[i] as RouteStop;
        const last = route[j] as RouteStop;
        const next = j === n - 1 ? undefined : (route[j + 1] as RouteStop);
        const before = haversineKm(prev, first) + (next ? haversineKm(last, next) : 0);
        const after = haversineKm(prev, last) + (next ? haversineKm(first, next) : 0);
        if (after < before - EPSILON) {
          route.splice(i, j - i + 1, ...route.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return route;
}

/** Orden final de visita: vecino más cercano + refinamiento 2-opt. */
export function optimizeRoute(origin: GeoPoint, stops: readonly RouteStop[]): RouteStop[] {
  return twoOpt(origin, nearestNeighbor(origin, stops));
}
