# EnvíoTrack

Paquetería: despacho web, rastreo público y app móvil para repartidores.

## Estructura

- `packages/shared`: tipos, esquemas Zod, Haversine / vecino más cercano / 2-opt
- `apps/api`: Express + TypeScript + Prisma 6 + PostgreSQL
- `apps/web`: React + Vite + Tailwind
- `apps/mobile`: Expo
- `docs/`: [contrato de la API](docs/contrato-api.md) (aprobado) y [plan del proyecto](docs/plan-proyecto.md)

## Requisitos

- Node.js 20 o superior y npm (usamos npm workspaces; no usar pnpm ni yarn)
- Git
- Docker, o un PostgreSQL 16 propio

## Puesta en marcha

1. Clonar e instalar (desde la raíz; instala todos los workspaces):

   ```bash
   git clone https://github.com/Rene3FG/envio-track.git
   cd envio-track
   npm install
   ```

2. Levantar PostgreSQL (si el puerto 5432 está ocupado, usa otro, por ejemplo `-p 5433:5432`):

   ```bash
   docker run --name envio-db -e POSTGRES_USER=envio -e POSTGRES_PASSWORD=envio \
     -e POSTGRES_DB=envio_track -p 5432:5432 -d postgres:16
   ```

3. Configurar las variables de la API. Si cambiaste el puerto, ajústalo en `DATABASE_URL`:

   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

4. Crear las tablas y cargar datos de prueba:

   ```bash
   npm run prisma:migrate -w @envio/api
   npm run prisma:seed -w @envio/api
   ```

El seed es idempotente (se puede repetir) y crea:

| Usuario | Rol | Contraseña |
|---|---|---|
| `admin@envio.test` | ADMIN | `cambiar123` |
| `repartidor1@envio.test` y siguientes | REPARTIDOR | `cambiar123` |

Son solo datos de desarrollo; nunca usar esas claves fuera de local.

## Comandos útiles

Se ejecutan desde la raíz con `-w <workspace>`:

| Comando | Para qué |
|---|---|
| `npm run prisma:generate -w @envio/api` | Regenerar el cliente de Prisma tras cambiar el esquema |
| `npm run prisma:migrate -w @envio/api` | Crear y aplicar una migración en desarrollo |
| `npm run prisma:deploy -w @envio/api` | Aplicar migraciones ya existentes (CI y producción) |
| `npm run prisma:seed -w @envio/api` | Cargar datos de prueba |
| `npx prisma studio` (dentro de `apps/api`) | Ver y editar la base en el navegador |

Para dejar la base como nueva: `npx prisma migrate reset` dentro de `apps/api` (borra todo y vuelve a correr el seed).

## Reglas de la base de datos

- El esquema vive en `apps/api/prisma/schema.prisma`. Cualquier cambio se hace con una migración, nunca editando tablas a mano.
- **Prisma 6** (`^6.4.0`), no actualizar a 7.
- Nada se borra: usuarios se desactivan con `activo=false`. Las relaciones opcionales llevan `onDelete: Restrict` explícito.
- No subir `.env` ni `node_modules`.

## Flujo de trabajo con git

`main` está protegida: no se puede hacer push directo.

1. Actualizar y crear tu rama desde `main`:

   ```bash
   git switch main && git pull
   git switch -c feature/p1-backend   # tu rama según tu rol
   ```

2. Trabajar y hacer commits cortos y claros, por ejemplo `Login con JWT y refresh`.
3. Subir tu rama: `git push -u origin feature/p1-backend`.
4. Abrir un Pull Request hacia `main` y pedir revisión de otra persona. No se hace merge sin visto bueno.
5. Antes de empezar un día de trabajo: `git pull` en `main` y `git merge main` en tu rama, para evitar conflictos grandes.

Ramas sugeridas: `feature/p1-backend`, `feature/p2-shared-sync`, `feature/p3-web-despacho`, `feature/p4-web-rastreo`, `feature/p5-mobile`. Cada persona toca principalmente su carpeta; si necesitas cambiar algo de otra (por ejemplo `packages/shared`), avisa en el grupo.

## Solución de problemas

- **`Environment variable not found: DATABASE_URL`**: falta crear `apps/api/.env` (paso 3).
- **`Can't reach database server`**: el contenedor no está corriendo (`docker start envio-db`) o el puerto de `DATABASE_URL` no coincide con el que publicaste.
- **El puerto 5432 está ocupado**: levanta Postgres con `-p 5433:5432` y cambia el puerto en `DATABASE_URL`.
