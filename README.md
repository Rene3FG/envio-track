# EnvíoTrack

[![CI](https://github.com/Rene3FG/envio-track/actions/workflows/ci.yml/badge.svg)](https://github.com/Rene3FG/envio-track/actions/workflows/ci.yml)

Gestor de entregas de paquetería: los administradores crean y asignan paquetes, los repartidores confirman entregas desde la app móvil (con foto y GPS, incluso sin conexión) y los clientes rastrean su envío por número de guía.

| Carpeta | Qué es |
|---|---|
| `api/` | FastAPI + SQLAlchemy + PostgreSQL (Python 3.12) |
| `web/` | React + Vite |
| `mobile/` | React Native con Expo |
| `packages/route/` | Algoritmo de ruta offline en JS puro |
| `infra/nginx/` | Proxy: `/api/` → API, `/` → web |
| `docs/` | Contrato de la API ([`openapi.yaml`](docs/openapi.yaml)) y [decisiones](docs/decisiones.md) |

## Levantar todo con Docker

```bash
cp .env.example .env   # opcional; hay valores por defecto
docker compose up --build
```

- App web: http://localhost:8080
- API a través del proxy: http://localhost:8080/api/health

## App móvil (Expo)

```bash
cd mobile
cp .env.example .env   # en un dispositivo físico, usa la IP de tu PC en EXPO_PUBLIC_API_URL
npm install
npx expo start
```

Escanea el QR con Expo Go, o pulsa `a` (emulador Android) / `i` (simulador iOS).

## Desarrollo sin Docker

```bash
# API (necesita un Postgres y DATABASE_URL)
cd api && pip install -r requirements.txt && uvicorn app.main:app --reload
ruff check . && pytest

# Web
cd web && npm install && npm run dev
npm run lint && npm test

# Algoritmo de ruta
cd packages/route && npm install && npm test
```

## Flujo de ramas

`feature/<nombre>` → Pull Request → `main`.

`main` está protegida: requiere PR, 1 aprobación y CI en verde. Rellena la plantilla del PR y actualiza `docs/openapi.yaml` si cambias la API.

## Funcionalidades y responsables

| # | Funcionalidad | Responsable |
|---|---|---|
| 1 | Usuarios y acceso | _por asignar_ |
| 2 | Paquetes y asignación | _por asignar_ |
| 3 | Confirmación de entrega | _por asignar_ |
| 4 | Offline y sincronización | _por asignar_ |
| 5 | Rutas y rastreo | _por asignar_ |
