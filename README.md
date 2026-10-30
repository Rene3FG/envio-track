# EnvíoTrack

Paquetería: despacho web, rastreo público y app móvil para repartidores.

## Estructura

- `packages/shared`: tipos, esquemas Zod, Haversine / vecino más cercano / 2-opt
- `apps/api`: Express + TypeScript + Prisma 6 + PostgreSQL
- `apps/web`: React + Vite + Tailwind
- `apps/mobile`: Expo

## Arranque (API)

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run prisma:migrate -w @envio/api
npm run prisma:seed -w @envio/api   # clave de prueba: cambiar123
```

## Flujo de trabajo

`main` está protegida: una rama `feature/<tema>` por persona y Pull Request.
