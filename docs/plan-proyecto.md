# EnvíoTrack — Plan completo del proyecto (para revisión)

Fecha: 2026-10-30. Estado: planeación cerrada; base del monorepo en el PR `feature/setup-monorepo`. Contrato de API en `docs/contrato-api.md` (aprobado).
Repo: github.com/Rene3FG/envio-track. `main` está protegida (no admite force-push).

## 1. Qué es

Sistema de paquetería: un despachador registra y asigna paquetes desde la web, los repartidores
los entregan con una app móvil (con o sin señal) y cualquier persona rastrea su paquete con la
guía, sin iniciar sesión. Es un trabajo **calificado** por rúbrica de 6 criterios.

## 2. Rúbrica (lo que se evalúa)

| # | Criterio | Peso | Requisitos |
|---|---|---|---|
| 1 | Full Stack + TypeScript | 20% | Sin `any`, Express por capas, DTOs compartidos, middleware de errores |
| 2 | Estado + UI/UX | 20% | Redux Toolkit o React Query, React Router v6, rutas protegidas, responsivo y accesible |
| 3 | Testing | 20% | Cobertura >80%, Supertest/Jest con BD de test aislada, E2E con Cypress o Playwright |
| 4 | Backend REST / seguridad | 15% | Richardson, JWT + refresh, bcrypt, validación y sanitización |
| 5 | React Native | 12.5% | Expo iOS/Android, offline con AsyncStorage, cámara y GPS |
| 6 | Docker + CI/CD | 12.5% | Multi-stage, compose con API/web/BD/proxy, GitHub Actions con lint + tests + deploy |

## 3. Arquitectura

Monorepo con **npm workspaces** (se descartó pnpm: con `hoisted` perdía su ventaja y Expo/Metro
va más seguro con npm). TypeScript en todo.

```
packages/shared   Zod, DTOs, Haversine + vecino más cercano + 2-opt
apps/api          Express + TypeScript + PostgreSQL + Prisma 6
apps/web          React + Vite + TypeScript + Tailwind, Router v6, TanStack Query, Leaflet
apps/mobile       Expo + TypeScript, AsyncStorage (@droptrack_pending_sync), cámara + GPS
```

Notas técnicas:
- **ORM: Prisma 6** (`^6.4.0`, no 7: el 7 mueve la URL a `prisma.config.ts`). Elegido por tipos generados.
- **Metro (Expo)** necesita `watchFolders` hacia `packages/shared`, y `"main": "src/index.ts"` en shared. Las versiones recientes de Expo ya lo hacen solas: probar antes de añadirlo.
- **Prisma en Alpine** (imagen del Dockerfile): hay que añadir `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` al generador y instalar `openssl` en la imagen, o la API no arranca.
- Mapa: Leaflet + OpenStreetMap (sin API key).

## 4. Modelo de datos (esquema final, PostgreSQL)

- **User**: nombre, email único, passwordHash, rol (enum ADMIN | REPARTIDOR), activo.
- **RefreshToken**: tokenHash único, expiraEn, revocado. Se borra en cascada con su usuario (única excepción).
- **Package**: guia única, destinatario, teléfono, dirección, referencias, lat/lng **obligatorias**, urgente,
  estado actual (REGISTRADO, ASIGNADO, EN_RUTA, ENTREGADO, FALLIDO), repartidorId directo.
- **PackageEvent** (historial): tipo (CREADO, ASIGNADO, EN_RUTA, ENTREGADO, INTENTO_FALLIDO), userId (quien ejecutó),
  repartidorId (**solo** en ASIGNADO), motivo, lat/lng, fotoUrl, `clientEventId` único (idempotencia),
  `requiereRevision`, ocurridoEn (cuándo pasó en la calle) y recibidoEn (cuándo lo procesó el servidor).
- Sin tabla de asignaciones: la asignación actual vive en `Package.repartidorId` y el historial en eventos ASIGNADO.
- **Nada se borra**: los usuarios se desactivan (`activo=false`). Los datos de prueba se limpian con seed.
- Hallazgo verificado en Postgres real: en relaciones opcionales Prisma usa `SetNull` por defecto, no `Restrict`.
  Por eso `Package.repartidor` y `PackageEvent.repartidor` llevan `onDelete: Restrict` explícito.
- Esquema completo en `~/Descargas/envio-track-esquema-db.txt`.

## 5. Reglas de negocio de la API

1. **Asignar/reasignar**: en una sola transacción, actualizar `repartidorId` y `estado` y crear evento ASIGNADO.
   Los eventos de servidor (CREADO, ASIGNADO) generan su `clientEventId` con `randomUUID()`.
2. **/sync idempotente**: si el `clientEventId` ya existe, se ignora y se responde éxito.
3. **Máquina de estados monótona**: el orden se toma por `ocurridoEn`, no por `recibidoEn`. Un evento atrasado
   (EN_RUTA, ASIGNADO) nunca regresa un paquete ya ENTREGADO.
4. **Doble entrega o chofer reasignado que entrega sin señal**: se guardan ambos eventos, el estado se queda en
   ENTREGADO y el conflictivo se marca `requiereRevision=true`. La realidad en campo manda: el ENTREGADO offline
   de un chofer reasignado **se acepta** y se avisa al despachador (filtro de revisión en el panel).
5. **INTENTO_FALLIDO**: guarda motivo, GPS y foto; el paquete pasa a FALLIDO, sale de la ruta activa y la app
   recalcula el 2-opt con las paradas restantes. El despachador reprograma o reasigna.
6. Historial de quién tuvo el paquete = eventos ASIGNADO ordenados por `ocurridoEn`.

## 6. Funcionalidades

- **API**: Auth (login JWT + refresh + bcrypt), CRUD de paquetes y asignación, `POST /api/upload` (multer, carpeta
  `/uploads` en volumen de Docker, servida estáticamente, devuelve `fotoUrl`), `/sync`, `/track`, `/stats`.
- **Web despacho**: login, gestión de choferes, alta de paquetes con selector de mapa (o zona predefinida),
  tabla con filtros por estado, chofer y `requiereRevision`.
- **Web pública**: `/tracking/:guia` sin login, modal visor de evidencias (foto, hora, GPS), dashboard `/stats`.
- **App móvil**: login con persistencia de token, Ruta del Día con reordenamiento local (2-opt), cámara
  (`expo-camera`), GPS (`expo-location`), cola offline en AsyncStorage que sincroniza al volver la señal.

## 7. Reparto del equipo (5 personas, aprobado por el equipo)

| | Negocio | DevOps / Soporte |
|---|---|---|
| **P1** Backend core | Prisma 6 + migración día 1, Auth, CRUD paquetes, `POST /api/upload`, Supertest | Dockerfile multi-stage Alpine de la API + `docker-compose.yml` (Postgres + API) |
| **P2** Shared + sync | `packages/shared`, Jest >90% en 2-opt, `/sync` (monótono, idempotente; asocia `fotoUrl` al evento) | `ci.yml` (lint, typecheck, tests con cobertura >80%) + módulo de cola offline `useOfflineSync.ts` para P5 |
| **P3** Web despacho | React+Vite+Tailwind+TanStack Query, login, choferes, alta con Leaflet, tabla con filtros | Vitest + React Testing Library |
| **P4** Web rastreo | `/tracking/:guia`, visor de evidencias, `/stats`, Playwright | Dockerfile de la web con Nginx (proxy `/api`) + deploy |
| **P5** App móvil | Expo, login, Ruta del Día con 2-opt, cámara + GPS | Integra el módulo offline de P2 |

Secuencia (diagrama del equipo):
1. P1 aplica la primera migración y los seeders.
2. P2 publica tipos y esquemas Zod en `packages/shared`.
3. Días 3 a 5: P3, P4 y P5 trabajan en paralelo consumiendo contratos reales, sin mocks.
4. P2 entrega `useOfflineSync` a P5.

## 8. Hosting propuesto

Railway o Render, desde el repo de GitHub (Postgres + API + web). Ojo: el Postgres gratis de Render caduca a
los 30 días; Railway funciona con créditos. Si la calificación es tarde, Railway es más seguro.

## 9. Estado actual

- Base del monorepo (npm workspaces, `apps/api` con Prisma 6, migración `init`, seed idempotente) en el PR de `feature/setup-monorepo`. Clave de prueba del seed: `cambiar123`.
- Aún no existen `packages/shared`, el código de la API, web ni mobile.

## 10. Pendientes y riesgos (para discutir)

1. **Fecha de entrega** y **qué se evalúa** exactamente (¿solo rúbrica o también demo?): sin definir.
2. **Hosting** definitivo (Railway vs Render).
3. **Alcance vs. rúbrica**: la rúbrica pide cobertura >80%, E2E, CI/CD, Docker y móvil; con 5 personas hay que decidir
   cuánto pulir de cada una.
4. **Carga de P2**: shared + `/sync` + CI + módulo offline es el rol más cargado y el que más bloquea a los demás.
5. **`/upload`** no estaba en el plan original: ahora lo toma P1.
6. **Dueño de git** y flujo: `main` protegida → ramas `feature/<tema>` + Pull Request; el repo está vacío y alguien debe
   hacer la base inicial (monorepo, workspaces, esquema) antes de que los demás puedan empezar.
7. **Tiempo de Expo en iOS**: requiere Expo Go o build; validar qué se puede demostrar sin Mac.
