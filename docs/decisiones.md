# Decisiones

- **Monorepo sin workspaces.** `web`, `mobile` y `packages/route` tienen su propio `package.json` y lockfile; así cada Dockerfile y Metro (Expo) resuelven sus dependencias sin trucos.
- **`packages/route` aún no está enlazado** a `web` ni `mobile`. Cuando se implemente, enlazarlo (p. ej. `"@enviotrack/route": "file:../packages/route"`) y ajustar el contexto de build del Dockerfile de web, que hoy es solo `./web`.
- **El proxy quita el prefijo `/api`**: `/api/health` llega a la API como `/health`.
- **Contrato primero**: `docs/openapi.yaml` se actualiza en el mismo PR que cambie la API.
