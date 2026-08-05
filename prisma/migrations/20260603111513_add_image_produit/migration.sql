-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'RESPONSABLE', 'CHEF_PATISSIER', 'GESTIONNAIRE', 'CAISSIER', 'COMPTABLE');

-- CreateEnum
CREATE TYPE "TypeCategorie" AS ENUM ('PRODUIT', 'MATIERE_PREMIERE');

-- CreateEnum
CREATE TYPE "TypeUnite" AS ENUM ('MASSE', 'VOLUME', 'COMPTAGE', 'CONDITIONNEMENT');

-- CreateEnum
CREATE TYPE "TypeMouvement" AS ENUM ('ENTREE_ACHAT', 'ENTREE_AJUSTEMENT', 'SORTIE_PRODUCTION', 'SORTIE_PERTE_MP', 'SORTIE_PERTE_PRODUIT', 'AJUSTEMENT');

-- CreateEnum
CREATE TYPE "StatutPaton" AS ENUM ('EN_CHAMBRE_FROIDE', 'FACONNE', 'PERDU');

-- CreateEnum
CREATE TYPE "CategorieProd" AS ENUM ('BOULANGERIE', 'VIENNOISERIE_PETRISSAGE', 'VIENNOISERIE_FACONNAGE', 'PATISSERIE');

-- CreateEnum
CREATE TYPE "StatutProduction" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "TypeProduction" AS ENUM ('VENTE', 'COMMANDE');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('ESPECES', 'MOBILE_MONEY', 'CARTE_BANCAIRE', 'VIREMENT', 'A_CREDIT', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypePerte" AS ENUM ('PRODUIT_FINI', 'MATIERE_PREMIERE');

-- CreateEnum
CREATE TYPE "TypeClient" AS ENUM ('PARTICULIER', 'PROFESSIONNEL');

-- CreateEnum
CREATE TYPE "StatutCommandeClient" AS ENUM ('RECUE', 'EN_PRODUCTION', 'PRETE', 'LIVREE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutCommandeFournisseur" AS ENUM ('BROUILLON', 'ENVOYEE', 'RECUE_PARTIELLE', 'RECUE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutLot" AS ENUM ('ACTIF', 'EPUISE', 'EXPIRE', 'PERDU');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Pâtisserie',
    "adresse" TEXT,
    "ville" TEXT,
    "pays" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "siteWeb" TEXT,
    "logoUrl" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'F',
    "couleurPrincipale" TEXT NOT NULL DEFAULT '#1a2744',
    "heureCloture" TEXT NOT NULL DEFAULT '17:00',
    "objectifCA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "seuilPertes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chargesFixesMensuelles" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CAISSIER',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categorie" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nom" TEXT NOT NULL,
    "type" "TypeCategorie" NOT NULL,
    "margeMin" DOUBLE PRECISION,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Categorie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unite" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nom" TEXT NOT NULL,
    "abreviation" TEXT NOT NULL,
    "type" "TypeUnite" NOT NULL,
    "uniteBase" TEXT NOT NULL,
    "coefficient" DOUBLE PRECISION NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Unite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fournisseur" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nom" TEXT NOT NULL,
    "contact" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "adresse" TEXT,
    "delaiLivraison" TEXT,
    "conditionsPaiement" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Fournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatierePremiere" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nom" TEXT NOT NULL,
    "prixAchat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockActuel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "seuilAlerte" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "stockGere" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,
    "categorieId" TEXT,
    "uniteId" TEXT,
    "fournisseurId" TEXT,

    CONSTRAINT "MatierePremiere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementStock" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "TypeMouvement" NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "motif" TEXT,
    "mpId" TEXT NOT NULL,

    CONSTRAINT "MouvementStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recette" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "ratioPate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "tauxPerte" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estViennoiserie" BOOLEAN NOT NULL DEFAULT false,
    "ingredientReference" TEXT NOT NULL DEFAULT 'FARINE',
    "ingredientReferenceNom" TEXT NOT NULL DEFAULT 'Farine',
    "ingredientReferenceUnite" TEXT NOT NULL DEFAULT 'kg',
    "categorie" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Recette_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecetteIngredient" (
    "id" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "recetteId" TEXT NOT NULL,
    "mpId" TEXT NOT NULL,
    "uniteId" TEXT,

    CONSTRAINT "RecetteIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produit" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nom" TEXT NOT NULL,
    "prixVente" DOUBLE PRECISION NOT NULL,
    "prixAchat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "margeMin" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "grammage" DOUBLE PRECISION,
    "stockActuel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "seuilAlerte" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dlvJours" INTEGER NOT NULL DEFAULT 1,
    "estSemiFini" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "companyId" TEXT NOT NULL,
    "categorieId" TEXT,
    "recetteId" TEXT,

    CONSTRAINT "Produit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavorisProduit" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FavorisProduit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneProduction" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "poidsUnitaire" DOUBLE PRECISION NOT NULL,
    "poidsTotal" DOUBLE PRECISION NOT NULL,
    "productionId" TEXT NOT NULL,

    CONSTRAINT "LigneProduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Production" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "numeroPetrin" INTEGER NOT NULL DEFAULT 1,
    "sessionProd" TEXT NOT NULL DEFAULT 'NUIT',
    "nomPetrisseur" TEXT,
    "heureDebut" TIMESTAMP(3),
    "heureFin" TIMESTAMP(3),
    "quantiteFarine" DOUBLE PRECISION NOT NULL,
    "pateTheorique" DOUBLE PRECISION NOT NULL,
    "pateEffective" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difference" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ecartPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pateRetournee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pateRecuperee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pateGatee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "causeGatee" TEXT,
    "pateGardee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "destinationPateGardee" TEXT,
    "categorieProd" "CategorieProd" NOT NULL DEFAULT 'BOULANGERIE',
    "statut" "StatutProduction" NOT NULL DEFAULT 'EN_ATTENTE',
    "typeProduction" "TypeProduction" NOT NULL DEFAULT 'VENTE',
    "nomClient" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateTerminaison" TIMESTAMP(3),
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "recetteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Production_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paton" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "poids" DOUBLE PRECISION NOT NULL,
    "poidsBeurre" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "poidsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nbPieces" INTEGER NOT NULL DEFAULT 0,
    "rendement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statutPaton" "StatutPaton" NOT NULL DEFAULT 'EN_CHAMBRE_FROIDE',
    "dateFaconnage" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "produitId" TEXT,

    CONSTRAINT "Paton_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionCaisse" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ouverteA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fermeeA" TIMESTAMP(3),
    "fondInitial" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalVentes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nbTransactions" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'OUVERTE',
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "SessionCaisse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vente" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montantTotal" DOUBLE PRECISION NOT NULL,
    "montantBrut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remiseMontant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remisePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "modePaiement" "ModePaiement" NOT NULL DEFAULT 'ESPECES',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "numero" INTEGER,
    "statut" TEXT NOT NULL DEFAULT 'VALIDEE',
    "motifAnnulation" TEXT,
    "splitPaiement" BOOLEAN NOT NULL DEFAULT false,
    "split1Mode" TEXT,
    "split1Montant" DOUBLE PRECISION,
    "split2Mode" TEXT,
    "split2Montant" DOUBLE PRECISION,
    "nomClient" TEXT,
    "clientId" TEXT,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Vente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneVente" (
    "id" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" DOUBLE PRECISION NOT NULL,
    "sousTotal" DOUBLE PRECISION NOT NULL,
    "venteId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,

    CONSTRAINT "LigneVente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Perte" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "TypePerte" NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "valeur" DOUBLE PRECISION NOT NULL,
    "cause" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "deductMP" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,
    "produitId" TEXT,
    "mpId" TEXT,

    CONSTRAINT "Perte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "TypeClient" NOT NULL DEFAULT 'PARTICULIER',
    "telephone" TEXT,
    "email" TEXT,
    "adresse" TEXT,
    "entreprise" TEXT,
    "notes" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "soldeCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandeClient" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutCommandeClient" NOT NULL DEFAULT 'RECUE',
    "dateLivraison" TIMESTAMP(3) NOT NULL,
    "montantTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "acompte" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "clientId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "CommandeClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneCommandeClient" (
    "id" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" DOUBLE PRECISION NOT NULL,
    "sousTotal" DOUBLE PRECISION NOT NULL,
    "commandeId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,

    CONSTRAINT "LigneCommandeClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandeFournisseur" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutCommandeFournisseur" NOT NULL DEFAULT 'BROUILLON',
    "dateCommande" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateLivraisonPrevue" TIMESTAMP(3),
    "dateLivraisonReelle" TIMESTAMP(3),
    "montantTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "fournisseurId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "CommandeFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneCommandeFournisseur" (
    "id" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "prixUnitaire" DOUBLE PRECISION NOT NULL,
    "sousTotal" DOUBLE PRECISION NOT NULL,
    "quantiteRecue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commandeId" TEXT NOT NULL,
    "mpId" TEXT NOT NULL,

    CONSTRAINT "LigneCommandeFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotStock" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "produitId" TEXT NOT NULL,
    "productionId" TEXT,
    "quantiteInitiale" INTEGER NOT NULL,
    "quantiteRestante" INTEGER NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL,
    "dateExpiration" TIMESTAMP(3) NOT NULL,
    "dlvJours" INTEGER NOT NULL,
    "statut" "StatutLot" NOT NULL DEFAULT 'ACTIF',
    "companyId" TEXT NOT NULL,
    "notesExpiration" TEXT,

    CONSTRAINT "LotStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloturJournee" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TIMESTAMP(3) NOT NULL,
    "heureRealisation" TIMESTAMP(3) NOT NULL,
    "caTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nbTransactions" INTEGER NOT NULL DEFAULT 0,
    "totalEspeces" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalMobile" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCarte" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalVirement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nbInvendus" INTEGER NOT NULL DEFAULT 0,
    "valeurInvendus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nbPertes" INTEGER NOT NULL DEFAULT 0,
    "valeurPertes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fondCaisse" DOUBLE PRECISION,
    "ecartFond" DOUBLE PRECISION,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CloturJournee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_companyId_key" ON "User"("email", "companyId");

-- CreateIndex
CREATE INDEX "FavorisProduit_companyId_position_idx" ON "FavorisProduit"("companyId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "FavorisProduit_companyId_produitId_key" ON "FavorisProduit"("companyId", "produitId");

-- CreateIndex
CREATE INDEX "SessionCaisse_companyId_ouverteA_idx" ON "SessionCaisse"("companyId", "ouverteA");

-- CreateIndex
CREATE INDEX "SessionCaisse_userId_idx" ON "SessionCaisse"("userId");

-- CreateIndex
CREATE INDEX "Vente_companyId_date_idx" ON "Vente"("companyId", "date");

-- CreateIndex
CREATE INDEX "Vente_companyId_modePaiement_idx" ON "Vente"("companyId", "modePaiement");

-- CreateIndex
CREATE INDEX "Vente_clientId_idx" ON "Vente"("clientId");

-- CreateIndex
CREATE INDEX "Perte_companyId_date_idx" ON "Perte"("companyId", "date");

-- CreateIndex
CREATE INDEX "Perte_companyId_type_idx" ON "Perte"("companyId", "type");

-- CreateIndex
CREATE INDEX "CommandeClient_companyId_statut_idx" ON "CommandeClient"("companyId", "statut");

-- CreateIndex
CREATE INDEX "CommandeClient_companyId_dateLivraison_idx" ON "CommandeClient"("companyId", "dateLivraison");

-- CreateIndex
CREATE INDEX "CommandeClient_clientId_idx" ON "CommandeClient"("clientId");

-- CreateIndex
CREATE INDEX "LotStock_companyId_statut_idx" ON "LotStock"("companyId", "statut");

-- CreateIndex
CREATE INDEX "LotStock_companyId_dateExpiration_idx" ON "LotStock"("companyId", "dateExpiration");

-- CreateIndex
CREATE INDEX "LotStock_produitId_statut_idx" ON "LotStock"("produitId", "statut");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categorie" ADD CONSTRAINT "Categorie_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unite" ADD CONSTRAINT "Unite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fournisseur" ADD CONSTRAINT "Fournisseur_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatierePremiere" ADD CONSTRAINT "MatierePremiere_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatierePremiere" ADD CONSTRAINT "MatierePremiere_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "Categorie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatierePremiere" ADD CONSTRAINT "MatierePremiere_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "Unite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatierePremiere" ADD CONSTRAINT "MatierePremiere_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_mpId_fkey" FOREIGN KEY ("mpId") REFERENCES "MatierePremiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recette" ADD CONSTRAINT "Recette_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecetteIngredient" ADD CONSTRAINT "RecetteIngredient_recetteId_fkey" FOREIGN KEY ("recetteId") REFERENCES "Recette"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecetteIngredient" ADD CONSTRAINT "RecetteIngredient_mpId_fkey" FOREIGN KEY ("mpId") REFERENCES "MatierePremiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecetteIngredient" ADD CONSTRAINT "RecetteIngredient_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "Unite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "Categorie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_recetteId_fkey" FOREIGN KEY ("recetteId") REFERENCES "Recette"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavorisProduit" ADD CONSTRAINT "FavorisProduit_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavorisProduit" ADD CONSTRAINT "FavorisProduit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneProduction" ADD CONSTRAINT "LigneProduction_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneProduction" ADD CONSTRAINT "LigneProduction_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_recetteId_fkey" FOREIGN KEY ("recetteId") REFERENCES "Recette"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paton" ADD CONSTRAINT "Paton_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paton" ADD CONSTRAINT "Paton_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paton" ADD CONSTRAINT "Paton_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCaisse" ADD CONSTRAINT "SessionCaisse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCaisse" ADD CONSTRAINT "SessionCaisse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVente" ADD CONSTRAINT "LigneVente_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "Vente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVente" ADD CONSTRAINT "LigneVente_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Perte" ADD CONSTRAINT "Perte_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Perte" ADD CONSTRAINT "Perte_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Perte" ADD CONSTRAINT "Perte_mpId_fkey" FOREIGN KEY ("mpId") REFERENCES "MatierePremiere"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeClient" ADD CONSTRAINT "CommandeClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeClient" ADD CONSTRAINT "CommandeClient_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommandeClient" ADD CONSTRAINT "LigneCommandeClient_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "CommandeClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommandeClient" ADD CONSTRAINT "LigneCommandeClient_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeFournisseur" ADD CONSTRAINT "CommandeFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeFournisseur" ADD CONSTRAINT "CommandeFournisseur_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommandeFournisseur" ADD CONSTRAINT "LigneCommandeFournisseur_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "CommandeFournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommandeFournisseur" ADD CONSTRAINT "LigneCommandeFournisseur_mpId_fkey" FOREIGN KEY ("mpId") REFERENCES "MatierePremiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotStock" ADD CONSTRAINT "LotStock_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotStock" ADD CONSTRAINT "LotStock_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotStock" ADD CONSTRAINT "LotStock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloturJournee" ADD CONSTRAINT "CloturJournee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloturJournee" ADD CONSTRAINT "CloturJournee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
