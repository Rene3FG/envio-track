-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'REPARTIDOR');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('REGISTRADO', 'ASIGNADO', 'EN_RUTA', 'ENTREGADO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CREADO', 'ASIGNADO', 'EN_RUTA', 'ENTREGADO', 'INTENTO_FALLIDO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Role" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "revocado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "guia" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "telefonoDestinatario" TEXT,
    "direccion" TEXT NOT NULL,
    "referencias" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "urgente" BOOLEAN NOT NULL DEFAULT false,
    "estado" "PackageStatus" NOT NULL DEFAULT 'REGISTRADO',
    "repartidorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageEvent" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "tipo" "EventType" NOT NULL,
    "userId" TEXT NOT NULL,
    "repartidorId" TEXT,
    "motivo" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "fotoUrl" TEXT,
    "clientEventId" TEXT NOT NULL,
    "requiereRevision" BOOLEAN NOT NULL DEFAULT false,
    "ocurridoEn" TIMESTAMP(3) NOT NULL,
    "recibidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Package_guia_key" ON "Package"("guia");

-- CreateIndex
CREATE INDEX "Package_repartidorId_estado_idx" ON "Package"("repartidorId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "PackageEvent_clientEventId_key" ON "PackageEvent"("clientEventId");

-- CreateIndex
CREATE INDEX "PackageEvent_packageId_ocurridoEn_idx" ON "PackageEvent"("packageId", "ocurridoEn");

-- CreateIndex
CREATE INDEX "PackageEvent_requiereRevision_idx" ON "PackageEvent"("requiereRevision");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_repartidorId_fkey" FOREIGN KEY ("repartidorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageEvent" ADD CONSTRAINT "PackageEvent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageEvent" ADD CONSTRAINT "PackageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageEvent" ADD CONSTRAINT "PackageEvent_repartidorId_fkey" FOREIGN KEY ("repartidorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
