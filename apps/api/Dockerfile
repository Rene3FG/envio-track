# ==========================================
# STAGE 1: Builder
# ==========================================
FROM node:20-alpine AS builder

# Instalar dependencias necesarias para compilar y para Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copiar manifiestos de paquetes del monorepo
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/

# Instalar dependencias completas del workspace
RUN npm ci

# Copiar esquema de Prisma y código fuente de la API
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/tsconfig.json ./apps/api/
COPY apps/api/src ./apps/api/src

# Generar el cliente de Prisma para Linux Musl (Alpine) y compilar TypeScript
RUN npm run prisma:generate -w @envio/api
RUN npm run build -w @envio/api

# ==========================================
# STAGE 2: Runner (Producción)
# ==========================================
FROM node:20-alpine AS runner

# Instalar openssl para el engine de Prisma y dumb-init para manejo de señales
RUN apk add --no-cache openssl libc6-compat dumb-init

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads

# Crear directorio para subida de fotos
RUN mkdir -p /app/uploads && chown -R node:node /app

# Copiar node_modules compilados y artefactos de build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./package.json

# Ejecutar como usuario no privilegiado por seguridad
USER node

EXPOSE 3000

# Usar dumb-init como PID 1 para manejar señales correctamente en contenedores
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/server.js"]
