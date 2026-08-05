-- CreateEnum
CREATE TYPE "OriginePerte" AS ENUM ('PRODUCTION', 'VENTE');

-- AlterTable
ALTER TABLE "CloturJournee" ADD COLUMN     "caVerifieParStock" DOUBLE PRECISION,
ADD COLUMN     "ecartVerification" DOUBLE PRECISION,
ADD COLUMN     "plageHoraireId" TEXT,
ADD COLUMN     "stockSnapshot" JSONB;

-- AlterTable
ALTER TABLE "Perte" ADD COLUMN     "origine" "OriginePerte" NOT NULL DEFAULT 'VENTE';

-- CreateTable
CREATE TABLE "PlageHoraire" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nom" TEXT NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "heureFin" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "PlageHoraire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlageHoraire_companyId_ordre_idx" ON "PlageHoraire"("companyId", "ordre");

-- CreateIndex
CREATE INDEX "CloturJournee_companyId_date_plageHoraireId_idx" ON "CloturJournee"("companyId", "date", "plageHoraireId");

-- AddForeignKey
ALTER TABLE "PlageHoraire" ADD CONSTRAINT "PlageHoraire_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloturJournee" ADD CONSTRAINT "CloturJournee_plageHoraireId_fkey" FOREIGN KEY ("plageHoraireId") REFERENCES "PlageHoraire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
