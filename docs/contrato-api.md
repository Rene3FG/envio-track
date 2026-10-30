# EnvíoTrack — Contrato de la API (borrador para revisión)

Base: `/api`. JSON UTF-8. Los tipos viven en `packages/shared` (Zod); lo que aquí se llama `XxxDto`
es el esquema Zod exportado, y el tipo TS se infiere con `z.infer`. Sin `any`.
Los campos y enums salen del esquema Prisma (`apps/api/prisma/schema.prisma`).

## 1. Convenciones

- **REST nivel 2 de Richardson**: recursos en plural, verbos HTTP, códigos de estado correctos.
- **Auth**: `Authorization: Bearer <accessToken>` (JWT, vida corta, p. ej. 15 min). Refresh token opaco
  de vida larga (p. ej. 7 días), guardado como hash en `RefreshToken`, rotado en cada uso.
- **Roles**: `ADMIN` (despachador) y `REPARTIDOR`. Un REPARTIDOR solo ve y modifica lo suyo.
- **Fechas**: ISO 8601 en UTC (`2026-10-30T15:36:21.000Z`).
- **IDs**: UUID, salvo `guia` (string único legible).
- **Validación**: todo body/query/params pasa por Zod en un middleware; entrada sanitizada (trim, longitudes máximas,
  sin HTML en textos libres). Error de validación → 400.
- **Paginación** (listas): `?page=1&pageSize=20` → `{ data: T[], page, pageSize, total }`.

### Formato de error (único, lo produce el middleware de errores)

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Texto legible", "details": [{ "path": "lat", "message": "Requerido" }] } }
```

| HTTP | code |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHENTICATED` (sin token, token vencido o inválido) |
| 403 | `FORBIDDEN` (rol o propiedad incorrectos) |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` (guía duplicada, usuario con email repetido, transición no permitida) |
| 413 | `PAYLOAD_TOO_LARGE` (foto) |
| 415 | `UNSUPPORTED_MEDIA_TYPE` |
| 429 | `RATE_LIMITED` (login) |
| 500 | `INTERNAL` (sin detalles al cliente) |

## 2. Auth — `/api/auth`

| Método | Ruta | Rol | Body | Respuesta |
|---|---|---|---|---|
| POST | `/auth/login` | público | `{ email, password }` | 200 `{ accessToken, refreshToken, user: UserDto }` |
| POST | `/auth/refresh` | público | `{ refreshToken }` | 200 `{ accessToken, refreshToken }` (el anterior queda revocado) |
| POST | `/auth/logout` | autenticado | `{ refreshToken }` | 204 |
| GET | `/auth/me` | autenticado | — | 200 `UserDto` |

- Credenciales malas → 401 con mensaje genérico (no revelar si el email existe). Usuario `activo=false` → 401.
- Reuso de un refresh token ya revocado → 401 y se revocan todos los tokens de ese usuario.
- Rate limit en login.

## 3. Usuarios — `/api/users` (ADMIN)

| Método | Ruta | Body / Query | Respuesta |
|---|---|---|---|
| GET | `/users` | `?rol=REPARTIDOR&activo=true` | 200 paginada de `UserDto` |
| POST | `/users` | `CreateUserDto { nombre, email, password, rol }` | 201 `UserDto` |
| PATCH | `/users/:id` | `UpdateUserDto { nombre?, email?, password?, activo? }` | 200 `UserDto` |

- **No hay DELETE**: nada se borra, se desactiva con `activo:false`. Desactivar a un repartidor con paquetes
  activos (ASIGNADO o EN_RUTA) → 409 hasta reasignarlos.
- `UserDto = { id, nombre, email, rol, activo, creadoEn }`. Nunca se devuelve `passwordHash`.

## 4. Paquetes — `/api/packages`

`PackageDto = { id, guia, destinatario, telefonoDestinatario, direccion, referencias, lat, lng, urgente, estado, repartidor: { id, nombre } | null, creadoEn, actualizadoEn }`

| Método | Ruta | Rol | Body / Query | Respuesta |
|---|---|---|---|---|
| GET | `/packages` | ADMIN: todos. REPARTIDOR: solo los suyos | `?estado=&repartidorId=&requiereRevision=&q=&page=&pageSize=` | 200 paginada de `PackageDto` |
| GET | `/packages/:id` | ADMIN o su repartidor | — | 200 `PackageDto` + `eventos: PackageEventDto[]` |
| POST | `/packages` | ADMIN | `CreatePackageDto { destinatario, telefonoDestinatario?, direccion, referencias?, lat, lng, urgente? }` | 201 `PackageDto` (estado REGISTRADO, `guia` generada por el servidor, evento CREADO) |
| PATCH | `/packages/:id` | ADMIN | `UpdatePackageDto` (campos de dirección/coordenadas/urgente) | 200 `PackageDto` |
| POST | `/packages/:id/assignment` | ADMIN | `{ repartidorId }` | 200 `PackageDto` |
| GET | `/packages/mine/route` | REPARTIDOR | — | 200 `PackageDto[]` activos (ASIGNADO y EN_RUTA) del día, sin ordenar: el orden lo calcula la app con 2-opt |

- `requiereRevision` en el filtro significa: paquetes que tengan al menos un evento con esa marca.
- `lat` ∈ [-90, 90], `lng` ∈ [-180, 180]; obligatorias.
- **Asignar / reasignar** (`/assignment`): una sola transacción — actualiza `repartidorId` y `estado = ASIGNADO` y crea
  evento `ASIGNADO` con `repartidorId` nuevo. El repartidor debe existir, estar `activo` y ser `REPARTIDOR`, si no → 409.
  No se puede asignar un paquete ENTREGADO → 409. Un FALLIDO sí se puede reasignar (vuelve a ASIGNADO).
- No hay DELETE de paquetes.

## 5. Sincronización — `/api/sync` (REPARTIDOR)

La app móvil acumula eventos sin señal en `@droptrack_pending_sync` y los envía en lote.

`POST /sync`
```json
{ "events": [ {
  "clientEventId": "uuid-generado-en-el-cliente",
  "packageId": "uuid",
  "tipo": "EN_RUTA | ENTREGADO | INTENTO_FALLIDO",
  "ocurridoEn": "2026-10-30T15:00:00.000Z",
  "lat": 17.06, "lng": -96.72,
  "motivo": "Nadie en casa",
  "fotoUrl": "/uploads/abc.jpg"
} ] }
```

Respuesta 200 siempre que el lote sea válido en forma; el resultado va **por evento**:

```json
{ "results": [ { "clientEventId": "...", "status": "ACCEPTED | DUPLICATE | REJECTED",
  "requiereRevision": false, "packageEstado": "ENTREGADO", "reason": null } ] }
```

Reglas (idénticas al esquema):
1. **Idempotente**: si `clientEventId` ya existe → `DUPLICATE` (cuenta como éxito; la app lo quita de la cola).
2. **Orden por `ocurridoEn`**, no por llegada. El servidor procesa el lote ordenado por `ocurridoEn`.
3. **Monótono**: un evento atrasado (EN_RUTA, ASIGNADO) nunca regresa un paquete que ya está ENTREGADO.
   Se guarda el evento, el estado no cambia.
4. **Doble entrega o chofer reasignado que entrega sin señal**: se **acepta** el ENTREGADO, se guarda, el estado queda
   ENTREGADO y el evento conflictivo se marca `requiereRevision: true`. Visible para el despachador por el filtro.
5. **INTENTO_FALLIDO**: exige `motivo`; el paquete pasa a FALLIDO.
6. `motivo` obligatorio solo en INTENTO_FALLIDO; `fotoUrl` opcional (la foto se sube antes con `/upload`).
7. `REJECTED` solo para eventos malformados o de un paquete inexistente; el resto de eventos del lote se procesa igual.
8. Un REPARTIDOR solo puede sincronizar eventos de paquetes que **tiene asignados o tuvo asignados**; otro → `REJECTED`
   con `reason: "NOT_YOUR_PACKAGE"`. (Pendiente de confirmar: ver sección 9.)
9. Tamaño máximo del lote: 100 eventos.

## 6. Fotos — `POST /api/upload` (REPARTIDOR y ADMIN)

- `multipart/form-data`, campo `foto`. Solo `image/jpeg` y `image/png`, máx. 5 MB.
- Se guarda en `/uploads` (volumen de Docker) con nombre aleatorio (nunca el original) y se sirve estático en `/uploads/<nombre>`.
- 201 `{ fotoUrl: "/uploads/<nombre>" }`. La app sube la foto primero y luego manda el evento con esa `fotoUrl` en `/sync`.
- Sin señal: la app guarda la foto local y la sube al reconectar, antes de sincronizar el evento.

## 7. Rastreo público — `GET /api/track/:guia` (sin login)

Respuesta 200 `TrackDto`:
```json
{ "guia": "ET-0001", "estado": "EN_RUTA", "destinatario": "J. P***",
  "eventos": [ { "tipo": "CREADO", "ocurridoEn": "...", "lat": null, "lng": null, "fotoUrl": null, "motivo": null } ] }
```
- Guía inexistente → 404 (mismo mensaje que cualquier otra no encontrada).
- Sin datos sensibles: **no** se devuelven teléfono, dirección completa, IDs internos, ni `requiereRevision`.
  El nombre del destinatario va abreviado. Rate limit por IP.
- Lo que sí ve el público para la evidencia (foto, hora y GPS del ENTREGADO) es lo que pide el visor de evidencias.
  Confirmar con el equipo que es aceptable mostrar el GPS exacto (ver sección 9).

## 8. Estadísticas — `GET /api/stats` (ADMIN)

```json
{ "total": 120, "porEstado": { "REGISTRADO": 10, "ASIGNADO": 20, "EN_RUTA": 15, "ENTREGADO": 65, "FALLIDO": 10 },
  "requierenRevision": 3,
  "porRepartidor": [ { "repartidorId": "...", "nombre": "...", "entregados": 30, "fallidos": 2 } ],
  "entregadosPorDia": [ { "fecha": "2026-10-30", "total": 12 } ] }
```
Query opcional `?desde=&hasta=` (fechas ISO).

## 9. Decisiones del equipo (2026-10-30) — contrato APROBADO

1. Se acepta ENTREGADO solo si el chofer tuvo el paquete asignado alguna vez (historial); se marca `requiereRevision: true`.
   Si nunca lo tuvo → `REJECTED` con `NOT_YOUR_PACKAGE`.
2. Rastreo público muestra foto, fecha/hora y coordenadas tal cual (lo pide la rúbrica).
3. `guia` = `ET-` + 6 dígitos (ej. `ET-104920`), única.
4. `EN_RUTA` por paquete en la API; la app móvil puede ofrecer un botón que marque todo el lote.
5. Avisos de revisión: filtro en la tabla y contador en `/stats`; sin WebSockets.
6. Sin estado CANCELADO: se mantienen los 5 estados.

Texto original de las preguntas (histórico):

1. ¿Un chofer puede sincronizar eventos de un paquete que ya no tiene asignado? El esquema dice que sí se acepta ENTREGADO
   (regla "la realidad en campo manda"); aquí se propone aceptar solo si alguna vez le fue asignado.
2. ¿El rastreo público muestra el GPS exacto de la entrega? Es privacidad del destinatario; alternativa: solo foto y hora.
3. ¿Formato de `guia`? Propuesta: `ET-` + número consecutivo de 6 dígitos o código corto aleatorio.
4. ¿El REPARTIDOR puede marcar `EN_RUTA` por paquete o una sola vez para toda su ruta? Aquí es por paquete.
5. ¿Las notificaciones al despachador por `requiereRevision` son solo el filtro en la tabla, o también un aviso en vivo?
   Aquí: solo filtro y contador en `/stats`.
6. ¿El despachador puede cancelar un paquete? El esquema no tiene estado CANCELADO. Aquí no se contempla.

## 10. Cómo lo usa cada persona

- **P1** implementa auth, users, packages (CRUD y asignación), upload; Supertest sobre esas rutas.
- **P2** exporta de `packages/shared` los DTO/Zod de todo este documento e implementa `/sync`.
- **P3** consume auth, users, packages.
- **P4** consume track y stats.
- **P5** consume auth, `packages/mine/route`, upload y sync (vía `useOfflineSync`).
