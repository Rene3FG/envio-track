import { DEPOT, haversineKm, nearestNeighbor, optimizeRoute, routeDistanceKm, twoOpt, RouteStop } from './optimizer';

const stop = (id: string, lat: number, lng: number): RouteStop => ({ id, lat, lng });
const ids = (r: RouteStop[]): string[] => r.map((s) => s.id);
const origin = { lat: 0, lng: 0 };

describe('haversineKm', () => {
  it('es 0 para el mismo punto', () => {
    expect(haversineKm(origin, origin)).toBe(0);
  });
  it('un grado de latitud ≈ 111.195 km', () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.195, 2);
  });
  it('Oaxaca ↔ CDMX ≈ 365 km', () => {
    const oaxaca = { lat: 17.0732, lng: -96.7266 };
    const cdmx = { lat: 19.4326, lng: -99.1332 };
    const d = haversineKm(oaxaca, cdmx);
    expect(d).toBeGreaterThan(363);
    expect(d).toBeLessThan(367);
  });
  it('es simétrica', () => {
    const a = { lat: 17.06, lng: -96.72 };
    const b = { lat: 17.1, lng: -96.8 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
  });
  it('maneja puntos antípodas sin NaN', () => {
    const d = haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
    expect(d).toBeCloseTo(Math.PI * 6371.0088, 3);
  });
  it.each([
    [{ lat: 91, lng: 0 }],
    [{ lat: -91, lng: 0 }],
    [{ lat: 0, lng: 181 }],
    [{ lat: 0, lng: -181 }],
    [{ lat: NaN, lng: 0 }],
    [{ lat: 0, lng: Infinity }],
  ])('rechaza coordenadas inválidas %j', (bad) => {
    expect(() => haversineKm(bad, origin)).toThrow(RangeError);
    expect(() => haversineKm(origin, bad)).toThrow(RangeError);
  });
});

describe('routeDistanceKm', () => {
  it('es 0 sin paradas', () => {
    expect(routeDistanceKm(origin, [])).toBe(0);
  });
  it('suma los tramos en orden', () => {
    const a = stop('a', 0, 1);
    const b = stop('b', 0, 2);
    expect(routeDistanceKm(origin, [a, b])).toBeCloseTo(haversineKm(origin, a) + haversineKm(a, b), 10);
  });
});

describe('nearestNeighbor', () => {
  it('devuelve [] sin paradas', () => {
    expect(nearestNeighbor(origin, [])).toEqual([]);
  });
  it('elige siempre la parada más cercana', () => {
    const r = nearestNeighbor(origin, [stop('lejos', 0, 3), stop('cerca', 0, 1), stop('medio', 0, 2)]);
    expect(ids(r)).toEqual(['cerca', 'medio', 'lejos']);
  });
  it('no muta la entrada', () => {
    const input = [stop('b', 0, 2), stop('a', 0, 1)];
    const copy = [...input];
    nearestNeighbor(origin, input);
    expect(input).toEqual(copy);
  });
  it('con empate mantiene el primero de la lista', () => {
    const r = nearestNeighbor(origin, [stop('n', 1, 0), stop('s', -1, 0)]);
    expect(ids(r)[0]).toBe('n');
  });
});

describe('twoOpt', () => {
  it('devuelve [] y una sola parada sin cambios', () => {
    expect(twoOpt(origin, [])).toEqual([]);
    expect(ids(twoOpt(origin, [stop('a', 1, 1)]))).toEqual(['a']);
  });
  it('deshace un cruce de aristas', () => {
    // cuadrado: el orden a,c,b,d se cruza; el óptimo recorre el perímetro
    const a = stop('a', 0, 1);
    const b = stop('b', 1, 1);
    const c = stop('c', 1, 0);
    const bad = [a, c, b];
    const out = twoOpt(origin, bad);
    expect(routeDistanceKm(origin, out)).toBeLessThan(routeDistanceKm(origin, bad));
  });
  it('invierte el tramo final (j = última parada)', () => {
    const a = stop('a', 0, 1);
    const b = stop('b', 0, 3);
    const c = stop('c', 0, 2);
    expect(ids(twoOpt(origin, [a, b, c]))).toEqual(['a', 'c', 'b']);
  });
  it('invierte un tramo intermedio con vecino siguiente', () => {
    const r = twoOpt(origin, [stop('a', 0, 1), stop('c', 0, 3), stop('b', 0, 2), stop('d', 0, 4)]);
    expect(ids(r)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('invierte desde el origen (i = 0)', () => {
    const r = twoOpt(origin, [stop('b', 0, 2), stop('a', 0, 1)]);
    expect(ids(r)).toEqual(['a', 'b']);
  });
  it('deja intacta una ruta ya óptima', () => {
    const input = [stop('a', 0, 1), stop('b', 0, 2), stop('c', 0, 3)];
    expect(ids(twoOpt(origin, input))).toEqual(['a', 'b', 'c']);
  });
  it('no muta la entrada', () => {
    const input = [stop('b', 0, 2), stop('a', 0, 1)];
    twoOpt(origin, input);
    expect(ids(input)).toEqual(['b', 'a']);
  });
});

describe('optimizeRoute', () => {
  it('conserva todas las paradas sin duplicar', () => {
    const input = Array.from({ length: 12 }, (_, i) => stop(`p${i}`, Math.sin(i) * 0.1, Math.cos(i * 2) * 0.1));
    const out = optimizeRoute(origin, input);
    expect(ids(out).sort()).toEqual(ids(input).sort());
  });
  it('nunca es peor que vecino más cercano', () => {
    const input = Array.from({ length: 15 }, (_, i) => stop(`p${i}`, Math.sin(i * 7) * 0.2, Math.cos(i * 3) * 0.2));
    expect(routeDistanceKm(origin, optimizeRoute(origin, input))).toBeLessThanOrEqual(
      routeDistanceKm(origin, nearestNeighbor(origin, input)) + 1e-9,
    );
  });
  it('ruta vacía', () => {
    expect(optimizeRoute(origin, [])).toEqual([]);
  });
});

describe('DEPOT', () => {
  it('es una coordenada válida dentro de México', () => {
    const { LatSchema, LngSchema } = jest.requireActual<typeof import('./schemas')>('./schemas');
    expect(LatSchema.safeParse(DEPOT.lat).success).toBe(true);
    expect(LngSchema.safeParse(DEPOT.lng).success).toBe(true);
  });
  it('sirve como origen de optimizeRoute', () => {
    const out = optimizeRoute(DEPOT, [stop('a', 17.07, -96.73), stop('b', 17.062, -96.726)]);
    expect(ids(out)).toEqual(['b', 'a']);
  });
});
