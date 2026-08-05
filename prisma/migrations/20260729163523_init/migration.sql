/*
  Warnings:

  - A unique constraint covering the columns `[username,companyId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('ESSAI', 'STANDARD', 'PRO');

-- CreateEnum
CREATE TYPE "StatutAbonnement" AS ENUM ('ESSAI', 'ACTIF', 'SUSPENDU', 'ANNULE');

-- AlterTable
ALTER TABLE "CommandeClient" ADD COLUMN     "modePaiement" "ModePaiement" NOT NULL DEFAULT 'ESPECES';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "dateFinEssai" TIMESTAMP(3),
ADD COLUMN     "dateProchainPaiement" TIMESTAMP(3),
ADD COLUMN     "montantAbonnement" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'ESSAI',
ADD COLUMN     "statutAbonnement" "StatutAbonnement" NOT NULL DEFAULT 'ESSAI';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "Paiement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "plan" "Plan" NOT NULL,
    "moyenPaiement" TEXT NOT NULL,
    "reference" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "entite" TEXT,
    "entiteId" TEXT,
    "details" TEXT,
    "ip" TEXT,
    "userId" TEXT,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosteActif" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "derniereActivite" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosteActif_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "PosteActif_companyId_derniereActivite_idx" ON "PosteActif"("companyId", "derniereActivite");

-- CreateIndex
CREATE UNIQUE INDEX "PosteActif_companyId_deviceId_key" ON "PosteActif"("companyId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_companyId_key" ON "User"("username", "companyId");

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
