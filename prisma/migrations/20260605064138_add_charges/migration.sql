-- CreateTable
CREATE TABLE "CategorieCharge" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nom" TEXT NOT NULL,
    "icone" TEXT NOT NULL DEFAULT '📋',
    "couleur" TEXT NOT NULL DEFAULT '#6B7280',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "CategorieCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "recurrence" TEXT NOT NULL DEFAULT 'PONCTUELLE',
    "moisRef" INTEGER,
    "anneeRef" INTEGER,
    "companyId" TEXT NOT NULL,
    "categorieId" TEXT NOT NULL,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategorieCharge_companyId_idx" ON "CategorieCharge"("companyId");

-- CreateIndex
CREATE INDEX "Charge_companyId_date_idx" ON "Charge"("companyId", "date");

-- CreateIndex
CREATE INDEX "Charge_companyId_categorieId_idx" ON "Charge"("companyId", "categorieId");

-- AddForeignKey
ALTER TABLE "CategorieCharge" ADD CONSTRAINT "CategorieCharge_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "CategorieCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
