// prisma/seed.ts
// Données de démonstration pour Délice Pro
// Boulangerie-Pâtisserie "La Délice d'Abidjan"
//
// Usage : npx ts-node prisma/seed.ts
// Ou ajoutez dans package.json :
//   "prisma": { "seed": "ts-node prisma/seed.ts" }
// Puis : npx prisma db seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateIl_y_a(jours: number, heure = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  d.setHours(heure, 0, 0, 0);
  return d;
}
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randF(min: number, max: number, dec = 2) {
  return Math.round((Math.random() * (max - min) + min) * 10 ** dec) / 10 ** dec;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Démarrage du seed Délice Pro...\n");

  // ── 0. Nettoyage (optionnel — commenter si vous voulez conserver les données) ──
  // ATTENTION : supprime TOUTES les données existantes
  console.log("🧹 Nettoyage des données existantes...");
  await prisma.cloturJournee.deleteMany();
  await prisma.ligneVente.deleteMany();
  await prisma.vente.deleteMany();
  await prisma.ligneCommandeFournisseur.deleteMany();
  await prisma.commandeFournisseur.deleteMany();
  await prisma.ligneCommandeClient.deleteMany();
  await prisma.commandeClient.deleteMany();
  await prisma.perte.deleteMany();
  await prisma.mouvementStock.deleteMany();
  await (prisma as any).lotStock.deleteMany();
  await (prisma as any).favorisProduit.deleteMany();
  await (prisma as any).sessionCaisse.deleteMany();
  await prisma.ligneProduction.deleteMany();
  await prisma.paton.deleteMany();
  await prisma.production.deleteMany();
  await prisma.recetteIngredient.deleteMany();
  await prisma.recette.deleteMany();
  await prisma.produit.deleteMany();
  await prisma.matierePremiere.deleteMany();
  await prisma.client.deleteMany();
  await prisma.categorie.deleteMany();
  await prisma.unite.deleteMany();
  await prisma.fournisseur.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
  console.log("✓ Nettoyage terminé\n");

  // ── 1. Entreprise ─────────────────────────────────────────────────────────────
  console.log("🏪 Création de l'entreprise...");
  const company = await prisma.company.create({
    data: {
      nom:                   "La Délice d'Abidjan",
      type:                  "Boulangerie-Pâtisserie",
      adresse:               "Rue des Jardins, Cocody",
      ville:                 "Abidjan",
      pays:                  "Côte d'Ivoire",
      telephone:             "+225 07 00 11 22 33",
      email:                 "contact@delice-abidjan.ci",
      devise:                "FCFA",
      couleurPrincipale:     "#1a2744",
      heureCloture:          "19:00",
      objectifCA:            150000,
      seuilPertes:           10000,
      chargesFixesMensuelles: 800000,
    },
  });
  console.log(`✓ Entreprise créée : ${company.nom}`);

  // ── 2. Utilisateurs ───────────────────────────────────────────────────────────
  console.log("\n👥 Création des utilisateurs...");
  const mdpHash = await bcrypt.hash("Delice2025!", 12);

  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      prenom: "Koné", nom: "Aminata",
      email: "admin@delice-abidjan.ci",
      passwordHash: mdpHash,
      role: "ADMIN",
      actif: true,
    },
  });

  const responsable = await prisma.user.create({
    data: {
      companyId: company.id,
      prenom: "Diallo", nom: "Ibrahim",
      email: "responsable@delice-abidjan.ci",
      passwordHash: mdpHash,
      role: "RESPONSABLE",
      actif: true,
    },
  });

  const chef = await prisma.user.create({
    data: {
      companyId: company.id,
      prenom: "Coulibaly", nom: "Moussa",
      email: "chef@delice-abidjan.ci",
      passwordHash: mdpHash,
      role: "CHEF_PATISSIER",
      actif: true,
    },
  });

  const caissier = await prisma.user.create({
    data: {
      companyId: company.id,
      prenom: "Touré", nom: "Fatou",
      email: "caissier@delice-abidjan.ci",
      passwordHash: mdpHash,
      role: "CAISSIER",
      actif: true,
    },
  });

  const gestionnaire = await prisma.user.create({
    data: {
      companyId: company.id,
      prenom: "Bamba", nom: "Seydou",
      email: "gestion@delice-abidjan.ci",
      passwordHash: mdpHash,
      role: "GESTIONNAIRE",
      actif: true,
    },
  });

  console.log(`✓ 5 utilisateurs créés (mot de passe : Delice2025!)`);
  console.log(`  - admin@delice-abidjan.ci (Admin)`);
  console.log(`  - responsable@delice-abidjan.ci (Responsable)`);
  console.log(`  - chef@delice-abidjan.ci (Chef Pâtissier)`);
  console.log(`  - caissier@delice-abidjan.ci (Caissier)`);
  console.log(`  - gestion@delice-abidjan.ci (Gestionnaire)`);

  // ── 3. Catégories ─────────────────────────────────────────────────────────────
  console.log("\n🏷️  Création des catégories...");
  const [catBoul, catVien, catPat, catCake, catSpecial] = await Promise.all([
    prisma.categorie.create({ data: { companyId: company.id, nom: "Boulangerie",    type: "PRODUIT",          margeMin: 55 } }),
    prisma.categorie.create({ data: { companyId: company.id, nom: "Viennoiserie",   type: "PRODUIT",          margeMin: 50 } }),
    prisma.categorie.create({ data: { companyId: company.id, nom: "Pâtisserie",     type: "PRODUIT",          margeMin: 45 } }),
    prisma.categorie.create({ data: { companyId: company.id, nom: "Gâteaux",        type: "PRODUIT",          margeMin: 40 } }),
    prisma.categorie.create({ data: { companyId: company.id, nom: "Spécialités",    type: "PRODUIT",          margeMin: 45 } }),
  ]);
  const [catFarine, catCorps, catLaitier, catSucre, catEmballage] = await Promise.all([
    prisma.categorie.create({ data: { companyId: company.id, nom: "Farines",        type: "MATIERE_PREMIERE" } }),
    prisma.categorie.create({ data: { companyId: company.id, nom: "Corps gras",     type: "MATIERE_PREMIERE" } }),
    prisma.categorie.create({ data: { companyId: company.id, nom: "Laitiers",       type: "MATIERE_PREMIERE" } }),
    prisma.categorie.create({ data: { companyId: company.id, nom: "Sucres",         type: "MATIERE_PREMIERE" } }),
    prisma.categorie.create({ data: { companyId: company.id, nom: "Emballage",      type: "MATIERE_PREMIERE" } }),
  ]);
  console.log(`✓ 10 catégories créées`);

  // ── 4. Unités ─────────────────────────────────────────────────────────────────
  console.log("\n⚖️  Création des unités...");
  const [uKg, uG, uL, uCl, uPce, uSac] = await Promise.all([
    prisma.unite.create({ data: { companyId: company.id, nom: "Kilogramme", abreviation: "kg",  type: "MASSE",          uniteBase: "kg",  coefficient: 1 } }),
    prisma.unite.create({ data: { companyId: company.id, nom: "Gramme",     abreviation: "g",   type: "MASSE",          uniteBase: "kg",  coefficient: 0.001 } }),
    prisma.unite.create({ data: { companyId: company.id, nom: "Litre",      abreviation: "L",   type: "VOLUME",         uniteBase: "L",   coefficient: 1 } }),
    prisma.unite.create({ data: { companyId: company.id, nom: "Centilitre", abreviation: "cL",  type: "VOLUME",         uniteBase: "L",   coefficient: 0.01 } }),
    prisma.unite.create({ data: { companyId: company.id, nom: "Pièce",      abreviation: "pce", type: "COMPTAGE",       uniteBase: "pce", coefficient: 1 } }),
    prisma.unite.create({ data: { companyId: company.id, nom: "Sachet",     abreviation: "sac", type: "CONDITIONNEMENT", uniteBase: "sac", coefficient: 1 } }),
  ]);
  console.log(`✓ 6 unités créées`);

  // ── 5. Fournisseurs ───────────────────────────────────────────────────────────
  console.log("\n🚛 Création des fournisseurs...");
  const [fournGB, fournLait, fournEmb, fournOil] = await Promise.all([
    prisma.fournisseur.create({
      data: {
        companyId: company.id,
        nom: "Grands Moulins d'Abidjan", contact: "M. Sylla",
        telephone: "+225 27 21 30 40 50", email: "commandes@gma.ci",
        adresse: "Zone Industrielle, Yopougon",
        delaiLivraison: "48h", conditionsPaiement: "30 jours fin de mois",
        actif: true,
      },
    }),
    prisma.fournisseur.create({
      data: {
        companyId: company.id,
        nom: "Société Laitière Ivoire", contact: "Mme Sanogo",
        telephone: "+225 07 05 20 30 40", email: "ventes@sli.ci",
        delaiLivraison: "24h", conditionsPaiement: "Paiement à livraison",
        actif: true,
      },
    }),
    prisma.fournisseur.create({
      data: {
        companyId: company.id,
        nom: "Pack & Go Emballages", contact: "M. Konaté",
        telephone: "+225 07 80 90 10 20",
        delaiLivraison: "72h", conditionsPaiement: "Comptant",
        actif: true,
      },
    }),
    prisma.fournisseur.create({
      data: {
        companyId: company.id,
        nom: "Huiles & Corps Gras CI", contact: "M. Traoré",
        telephone: "+225 07 40 50 60 70",
        delaiLivraison: "48h", conditionsPaiement: "15 jours",
        actif: true,
      },
    }),
  ]);
  console.log(`✓ 4 fournisseurs créés`);

  // ── 6. Matières premières ──────────────────────────────────────────────────────
  console.log("\n🌾 Création des matières premières...");

  const mps = await Promise.all([
    // Farines
    prisma.matierePremiere.create({ data: {
      companyId: company.id, categorieId: catFarine.id, uniteId: uKg.id,
      fournisseurId: fournGB.id,
      nom: "Farine de blé T55", prixAchat: 850, stockActuel: 250, seuilAlerte: 50,
      actif: true, stockGere: true,
    }}),
    prisma.matierePremiere.create({ data: {
      companyId: company.id, categorieId: catFarine.id, uniteId: uKg.id,
      fournisseurId: fournGB.id,
      nom: "Farine de blé T45 (pâtisserie)", prixAchat: 950, stockActuel: 80, seuilAlerte: 20,
      actif: true, stockGere: true,
    }}),
    prisma.matierePremiere.create({ data: {
      companyId: company.id, categorieId: catFarine.id, uniteId: uKg.id,
      fournisseurId: fournGB.id,
      nom: "Farine complète T80", prixAchat: 780, stockActuel: 40, seuilAlerte: 15,
      actif: true, stockGere: true,
    }}),
    // Corps gras
    prisma.matierePremiere.create({ data: {
      companyId: company.id, categorieId: catCorps.id, uniteId: uKg.id,
      fournisseurId: fournOil.id,
      nom: "Beurre de qualité", prixAchat: 3200, stockActuel: 30, seuilAlerte: 8,
      actif: true, stockGere: true,
    }}),
    prisma.matierePremiere.create({ data: {
      companyId: company.id, categorieId: catCorps.id, uniteId: uKg.id,
      fournisseurId: fournOil.id,
      nom: "Margarine pâtissière", prixAchat: 1800, stockActuel: 45, seuilAlerte: 10,
      actif: true, stockGere: true,
    }}),
    prisma.matierePremiere.create({ data: {
      companyId: company.id, categorieId: catCorps.id, uniteId: uL.id,
      fournisseurId: fournOil.id,
      nom: "Huile végétale", prixAchat: 1200, stockActuel: 20, seuilAlerte: 5,
      actif: true, stockGere: true,
    }}),
    // Laitiers
    prisma.matierePremiere.create({ data: {
      companyId: company.id, categorieId: catLaitier.id, uniteId: uL.id,
      fournisseurId: fournLait.id,
      nom: "Lait entier frais", prixAchat: 650, stockActuel: 60, seuilAlerte: 20,
      actif: true, stockGere: true,
    }}),
    prisma.matierePremiere.create({ data: {
      companyId: company.id, categorieId: catLaitier.id, uniteId: uKg.id,
      fournisseurId: fournLait.id,
      nom: "Œufs frais (plateau 30)", prixAchat: 4500, stockActuel: 10, seuilAlerte: 3,
      actif: true, stockGere: true,
    }}),
    prisma.matierePremiere.create({ data: {
      companyId: company.id, categorieId: catLaitier.id, uniteId: uKg.id,
      fournisseurId: fournLait.id,
      nom: "Crème fraîche épaisse", prixAchat: 4800, stockActuel: 8, seuilAlerte: 2,
      actif: true, stockGere: true,
    }}),
    // Sucres
    prisma.matierePremiere.create({ data: {
      companyId: company.id, categorieId: catSucre.id, uniteId: uKg.id,
      nom: "Sucre semoule blanc", prixAchat: 650, stockActuel: 120, seuilAlerte: 30,
      actif: true, stockGere: true,
    }}),
    prisma.matierePremiere.create({ data: {
      companyId: company.id, categorieId: catSucre.id, uniteId: uKg.id,
      nom: "Sucre glace", prixAchat: 750, stockActuel: 25, seuilAlerte: 8,
      actif: true, stockGere: true,
    }}),
    // Levures & additifs
    prisma.matierePremiere.create({ data: {
      companyId: company.id, categorieId: catFarine.id, uniteId: uKg.id,
      fournisseurId: fournGB.id,
      nom: "Levure boulangère fraîche", prixAchat: 1200, stockActuel: 5, seuilAlerte: 2,
      actif: true, stockGere: true,
    }}),
    prisma.matierePremiere.create({ data: {
      companyId: company.id, categorieId: catFarine.id, uniteId: uKg.id,
      nom: "Sel fin", prixAchat: 200, stockActuel: 20, seuilAlerte: 5,
      actif: true, stockGere: true,
    }}),
    prisma.matierePremiere.create({ data: {
      companyId: company.id, categorieId: catSucre.id, uniteId: uKg.id,
      nom: "Chocolat noir couverture", prixAchat: 8500, stockActuel: 6, seuilAlerte: 2,
      actif: true, stockGere: true,
    }}),
    prisma.matierePremiere.create({ data: {
      companyId: company.id, categorieId: catSucre.id, uniteId: uKg.id,
      nom: "Poudre de cacao", prixAchat: 5200, stockActuel: 4, seuilAlerte: 1,
      actif: true, stockGere: true,
    }}),
    // Emballages
    prisma.matierePremiere.create({ data: {
      companyId: company.id, categorieId: catEmballage.id, uniteId: uPce.id,
      fournisseurId: fournEmb.id,
      nom: "Sachet pain baguette", prixAchat: 15, stockActuel: 2000, seuilAlerte: 500,
      actif: true, stockGere: false, // non géré = coût nul dans calcul marge
    }}),
    prisma.matierePremiere.create({ data: {
      companyId: company.id, categorieId: catEmballage.id, uniteId: uPce.id,
      fournisseurId: fournEmb.id,
      nom: "Boîte pâtisserie individuelle", prixAchat: 150, stockActuel: 500, seuilAlerte: 100,
      actif: true, stockGere: false,
    }}),
  ]);

  const [farine55, farineT45, farineCpl, beurre, margarine, huile,
         lait, oeufs, creme, sucre, sucreGlace, levure, sel,
         chocolat, cacao, sachetPain, boitePat] = mps;

  console.log(`✓ ${mps.length} matières premières créées`);

  // ── 7. Recettes ───────────────────────────────────────────────────────────────
  console.log("\n📖 Création des recettes...");

  // Recette Baguette tradition
  const recBaguette = await prisma.recette.create({
    data: {
      companyId: company.id,
      nom: "Baguette Tradition",
      ratioPate: 1.62,
      tauxPerte: 12,
      categorie: "BOULANGERIE",
      estViennoiserie: false,
      ingredientReference: "FARINE",
      ingredientReferenceNom: "Farine T55",
      ingredientReferenceUnite: "kg",
      actif: true,
      ingredients: {
        create: [
          { mpId: farine55.id, uniteId: uKg.id, quantite: 1 },
          { mpId: levure.id,   uniteId: uKg.id, quantite: 0.02 },
          { mpId: sel.id,      uniteId: uKg.id, quantite: 0.018 },
        ],
      },
    },
  });

  // Recette Pain de mie
  const recPainMie = await prisma.recette.create({
    data: {
      companyId: company.id,
      nom: "Pain de Mie",
      ratioPate: 1.55,
      tauxPerte: 8,
      categorie: "BOULANGERIE",
      estViennoiserie: false,
      ingredientReference: "FARINE",
      ingredientReferenceNom: "Farine T55",
      ingredientReferenceUnite: "kg",
      actif: true,
      ingredients: {
        create: [
          { mpId: farine55.id,  uniteId: uKg.id, quantite: 1 },
          { mpId: margarine.id, uniteId: uKg.id, quantite: 0.08 },
          { mpId: sucre.id,     uniteId: uKg.id, quantite: 0.06 },
          { mpId: lait.id,      uniteId: uL.id, quantite: 0.3 },
          { mpId: levure.id,    uniteId: uKg.id, quantite: 0.025 },
          { mpId: sel.id,       uniteId: uKg.id, quantite: 0.015 },
        ],
      },
    },
  });

  // Recette Croissant (viennoiserie)
  const recCroissant = await prisma.recette.create({
    data: {
      companyId: company.id,
      nom: "Croissant Beurre",
      ratioPate: 1.45,
      tauxPerte: 10,
      categorie: "BOULANGERIE",
      estViennoiserie: true,
      ingredientReference: "FARINE",
      ingredientReferenceNom: "Farine T45",
      ingredientReferenceUnite: "kg",
      actif: true,
      ingredients: {
        create: [
          { mpId: farineT45.id, uniteId: uKg.id, quantite: 1 },
          { mpId: beurre.id,    uniteId: uKg.id, quantite: 0.5 },
          { mpId: sucre.id,     uniteId: uKg.id, quantite: 0.12 },
          { mpId: lait.id,      uniteId: uL.id, quantite: 0.2 },
          { mpId: oeufs.id,     uniteId: uKg.id, quantite: 0.06 },
          { mpId: levure.id,    uniteId: uKg.id, quantite: 0.02 },
          { mpId: sel.id,       uniteId: uKg.id, quantite: 0.01 },
        ],
      },
    },
  });

  // Recette Gâteau au chocolat
  const recChoco = await prisma.recette.create({
    data: {
      companyId: company.id,
      nom: "Fondant Chocolat",
      ratioPate: 1.0,
      tauxPerte: 5,
      categorie: "PATISSERIE",
      estViennoiserie: false,
      ingredientReference: "FARINE",
      ingredientReferenceNom: "Farine T45",
      ingredientReferenceUnite: "kg",
      actif: true,
      ingredients: {
        create: [
          { mpId: farineT45.id, uniteId: uKg.id, quantite: 1 },
          { mpId: chocolat.id,  uniteId: uKg.id, quantite: 1.5 },
          { mpId: beurre.id,    uniteId: uKg.id, quantite: 0.8 },
          { mpId: sucre.id,     uniteId: uKg.id, quantite: 0.8 },
          { mpId: oeufs.id,     uniteId: uKg.id, quantite: 0.3 },
        ],
      },
    },
  });

  // Recette Pain complet
  const recComplet = await prisma.recette.create({
    data: {
      companyId: company.id,
      nom: "Pain Complet",
      ratioPate: 1.6,
      tauxPerte: 10,
      categorie: "BOULANGERIE",
      estViennoiserie: false,
      ingredientReference: "FARINE",
      ingredientReferenceNom: "Farine T80",
      ingredientReferenceUnite: "kg",
      actif: true,
      ingredients: {
        create: [
          { mpId: farineCpl.id, uniteId: uKg.id, quantite: 0.7 },
          { mpId: farine55.id,  uniteId: uKg.id, quantite: 0.3 },
          { mpId: levure.id,    uniteId: uKg.id, quantite: 0.015 },
          { mpId: sel.id,       uniteId: uKg.id, quantite: 0.018 },
          { mpId: huile.id,     uniteId: uL.id, quantite: 0.02 },
        ],
      },
    },
  });

  console.log(`✓ 5 recettes créées`);

  // ── 8. Produits finis ──────────────────────────────────────────────────────────
  console.log("\n🥐 Création des produits finis...");

  const produits = await Promise.all([
    // Boulangerie
    prisma.produit.create({ data: {
      companyId: company.id, recetteId: recBaguette.id, categorieId: catBoul.id,
      nom: "Baguette tradition 250g",
      prixVente: 250, margeMin: 60, grammage: 250, dlvJours: 1,
      stockActuel: 45, seuilAlerte: 20, estSemiFini: false, actif: true,
    }}),
    prisma.produit.create({ data: {
      companyId: company.id, recetteId: recBaguette.id, categorieId: catBoul.id,
      nom: "Baguette spéciale 350g",
      prixVente: 350, margeMin: 60, grammage: 350, dlvJours: 1,
      stockActuel: 30, seuilAlerte: 15, estSemiFini: false, actif: true,
    }}),
    prisma.produit.create({ data: {
      companyId: company.id, recetteId: recPainMie.id, categorieId: catBoul.id,
      nom: "Pain de mie tranché 400g",
      prixVente: 850, margeMin: 55, grammage: 400, dlvJours: 3,
      stockActuel: 20, seuilAlerte: 8, estSemiFini: false, actif: true,
    }}),
    prisma.produit.create({ data: {
      companyId: company.id, recetteId: recComplet.id, categorieId: catBoul.id,
      nom: "Pain complet 300g",
      prixVente: 500, margeMin: 55, grammage: 300, dlvJours: 2,
      stockActuel: 15, seuilAlerte: 5, estSemiFini: false, actif: true,
    }}),
    // Viennoiserie
    prisma.produit.create({ data: {
      companyId: company.id, recetteId: recCroissant.id, categorieId: catVien.id,
      nom: "Croissant beurre",
      prixVente: 400, margeMin: 50, grammage: 80, dlvJours: 1,
      stockActuel: 24, seuilAlerte: 10, estSemiFini: false, actif: true,
    }}),
    prisma.produit.create({ data: {
      companyId: company.id, recetteId: recCroissant.id, categorieId: catVien.id,
      nom: "Pain au chocolat",
      prixVente: 450, margeMin: 50, grammage: 100, dlvJours: 1,
      stockActuel: 18, seuilAlerte: 8, estSemiFini: false, actif: true,
    }}),
    prisma.produit.create({ data: {
      companyId: company.id, recetteId: recCroissant.id, categorieId: catVien.id,
      nom: "Brioche individuelle",
      prixVente: 350, margeMin: 50, grammage: 90, dlvJours: 2,
      stockActuel: 12, seuilAlerte: 6, estSemiFini: false, actif: true,
    }}),
    // Pâtisserie
    prisma.produit.create({ data: {
      companyId: company.id, recetteId: recChoco.id, categorieId: catPat.id,
      nom: "Fondant chocolat (part)",
      prixVente: 1200, margeMin: 45, grammage: 120, dlvJours: 2,
      stockActuel: 10, seuilAlerte: 4, estSemiFini: false, actif: true,
    }}),
    prisma.produit.create({ data: {
      companyId: company.id, categorieId: catCake.id,
      nom: "Gâteau d'anniversaire 6 pers.",
      prixVente: 18000, margeMin: 40, dlvJours: 2,
      stockActuel: 2, seuilAlerte: 1, estSemiFini: false, actif: true,
    }}),
    prisma.produit.create({ data: {
      companyId: company.id, categorieId: catPat.id,
      nom: "Éclair chocolat",
      prixVente: 600, margeMin: 45, grammage: 80, dlvJours: 1,
      stockActuel: 16, seuilAlerte: 6, estSemiFini: false, actif: true,
    }}),
    prisma.produit.create({ data: {
      companyId: company.id, categorieId: catSpecial.id,
      nom: "Kouign-Amann",
      prixVente: 1500, margeMin: 45, grammage: 200, dlvJours: 2,
      stockActuel: 8, seuilAlerte: 3, estSemiFini: false, actif: true,
    }}),
    // Semi-fini
    prisma.produit.create({ data: {
      companyId: company.id, recetteId: recCroissant.id, categorieId: catVien.id,
      nom: "Pâton croissant (semi-fini)",
      prixVente: 0, margeMin: 0, grammage: 200, dlvJours: 2,
      stockActuel: 0, seuilAlerte: 0, estSemiFini: true, actif: true,
    }}),
  ]);

  const [pBaguette, pBagSpec, pPainMie, pPainCpl,
         pCroissant, pPainChoco, pBrioche,
         pFondant, pGateau, pEclair, pKouign, pPatonCroissant] = produits;

  console.log(`✓ ${produits.length} produits créés`);

  // ── 9. Clients ────────────────────────────────────────────────────────────────
  console.log("\n👤 Création des clients...");
  const clients = await Promise.all([
    prisma.client.create({ data: {
      companyId: company.id,
      nom: "Hôtel Ivoire Palace", type: "PROFESSIONNEL",
      telephone: "+225 27 20 10 20 30", email: "appros@ivoire-palace.ci",
      adresse: "Plateau, Abidjan", entreprise: "Ivoire Palace",
      actif: true, soldeCredit: 0,
    } as any }),
    prisma.client.create({ data: {
      companyId: company.id,
      nom: "Restaurant Le Baobab", type: "PROFESSIONNEL",
      telephone: "+225 07 15 25 35 45", email: "cuisine@lebaobab.ci",
      entreprise: "Le Baobab SARL",
      actif: true, soldeCredit: 45000,
    } as any }),
    prisma.client.create({ data: {
      companyId: company.id,
      nom: "Koné Marie-Claire", type: "PARTICULIER",
      telephone: "+225 07 88 99 11 22",
      actif: true, soldeCredit: 12500,
    } as any }),
    prisma.client.create({ data: {
      companyId: company.id,
      nom: "École Sainte-Marie", type: "PROFESSIONNEL",
      telephone: "+225 27 22 33 44 55",
      entreprise: "Groupe Scolaire Sainte-Marie",
      actif: true, soldeCredit: 0,
    } as any }),
    prisma.client.create({ data: {
      companyId: company.id,
      nom: "Diaby Fatoumata", type: "PARTICULIER",
      telephone: "+225 07 77 88 99 00",
      actif: true, soldeCredit: 0,
    } as any }),
    prisma.client.create({ data: {
      companyId: company.id,
      nom: "Traiteur Festin d'Or", type: "PROFESSIONNEL",
      telephone: "+225 07 55 66 77 88",
      entreprise: "Festin d'Or Evénements",
      actif: true, soldeCredit: 75000,
    } as any }),
  ]);

  console.log(`✓ ${clients.length} clients créés`);

  // ── 10. Productions (30 derniers jours) ───────────────────────────────────────
  console.log("\n🏭 Création des productions...");

  const productions: any[] = [];
  for (let j = 0; j < 30; j++) {
    const date = dateIl_y_a(j, rand(4, 6)); // 4h-6h du matin

    // Pétrin boulangerie quotidien
    const qteFarine = randF(8, 15, 1);
    const pateTheo  = Math.round(qteFarine * 1.62 * 10) / 10;
    const pateEff   = Math.round((pateTheo * randF(0.93, 1.02, 3)) * 10) / 10;

    const nbBaguettes   = rand(40, 80);
    const nbBaguettesSp = rand(15, 30);
    const nbPainsMie    = rand(8, 18);

    const prod = await prisma.production.create({
      data: {
        company:  { connect: { id: company.id } },
        recette:  { connect: { id: recBaguette.id } },
        user:     { connect: { id: chef.id } },
        date,
        quantiteFarine: qteFarine,
        pateTheorique:  pateTheo,
        pateEffective:  pateEff,
        pateGatee:      Math.max(0, pateTheo - pateEff - 0.2),
        pateRetournee:  0.2,
        pateGardee:     0,
        ecartPct:       Math.round(Math.abs((pateEff - pateTheo) / pateTheo) * 10000) / 100,
        numeroPetrin:   1,
        sessionProd:    "NUIT",
        categorieProd:  "BOULANGERIE",
        statut:         "TERMINEE",
        lignesProduction: {
          create: [
            { produitId: pBaguette.id, quantite: nbBaguettes,   poidsUnitaire: 250, poidsTotal: nbBaguettes * 0.25 },
            { produitId: pBagSpec.id,  quantite: nbBaguettesSp, poidsUnitaire: 350, poidsTotal: nbBaguettesSp * 0.35 },
            { produitId: pPainMie.id,  quantite: nbPainsMie,    poidsUnitaire: 400, poidsTotal: nbPainsMie * 0.4 },
          ],
        },
      },
    });
    productions.push(prod);

    // Viennoiserie 3 fois par semaine
    if (j % 3 === 0) {
      const qteFarineVien = randF(3, 6, 1);
      const pateTVienn    = Math.round(qteFarineVien * 1.45 * 10) / 10;
      const pateEVien     = Math.round((pateTVienn * randF(0.94, 1.0, 3)) * 10) / 10;
      const nbCroissants  = rand(20, 40);
      const nbPainsChoco  = rand(15, 30);

      await prisma.production.create({
        data: {
          company:  { connect: { id: company.id } },
          recette:  { connect: { id: recCroissant.id } },
          user:     { connect: { id: chef.id } },
          date: new Date(date.getTime() + 3600000),
          quantiteFarine: qteFarineVien,
          pateTheorique:  pateTVienn,
          pateEffective:  pateEVien,
          pateGatee:      0.1,
          pateRetournee:  0,
          pateGardee:     0,
          ecartPct:       Math.round(Math.abs((pateEVien - pateTVienn) / pateTVienn) * 10000) / 100,
          numeroPetrin:   2,
          sessionProd:    "MATIN",
          categorieProd:  "PATISSERIE",
          statut:         "TERMINEE",
          lignesProduction: {
            create: [
              { produitId: pCroissant.id,  quantite: nbCroissants, poidsUnitaire: 80,  poidsTotal: nbCroissants * 0.08 },
              { produitId: pPainChoco.id,  quantite: nbPainsChoco, poidsUnitaire: 100, poidsTotal: nbPainsChoco * 0.1 },
              { produitId: pBrioche.id,    quantite: rand(10, 20), poidsUnitaire: 90,  poidsTotal: rand(10, 20) * 0.09 },
            ],
          },
        },
      });
    }
  }
  console.log(`✓ ~${productions.length * 1.3 | 0} sessions de production créées`);

  // ── 11. Ventes (30 derniers jours) ────────────────────────────────────────────
  console.log("\n🛒 Création des ventes...");

  const modesVente: any[] = ["ESPECES", "ESPECES", "ESPECES", "MOBILE_MONEY", "MOBILE_MONEY", "A_CREDIT"];
  let nbVentes = 0;

  for (let j = 0; j < 30; j++) {
    const nbVentesJour = rand(15, 35);
    for (let v = 0; v < nbVentesJour; v++) {
      const heure = rand(7, 20);
      const date  = dateIl_y_a(j, heure);
      const mode  = pick(modesVente);
      const clientId = mode === "A_CREDIT" ? pick(clients).id : null;

      // Générer les lignes
      const nbLignes = rand(1, 4);
      const lignesProduits = [pBaguette, pBagSpec, pPainMie, pCroissant, pPainChoco, pFondant, pEclair, pBrioche];
      const lignesChoisies = [];
      const dejaPris = new Set<string>();
      for (let l = 0; l < nbLignes; l++) {
        let produit = pick(lignesProduits);
        let attempts = 0;
        while (dejaPris.has(produit.id) && attempts < 5) { produit = pick(lignesProduits); attempts++; }
        if (dejaPris.has(produit.id)) continue;
        dejaPris.add(produit.id);
        const qte = rand(1, 5);
        lignesChoisies.push({ produit, qte });
      }

      const montantTotal = Math.round(lignesChoisies.reduce((s, l) => s + l.produit.prixVente * l.qte, 0));
      const remise = rand(0, 3) === 0 ? Math.round(montantTotal * 0.05) : 0;
      const montantFinal = montantTotal - remise;

      await prisma.vente.create({
        data: {
          company:  { connect: { id: company.id } },
          user:     { connect: { id: pick([caissier.id, admin.id]) } },
          ...(clientId ? { client: { connect: { id: clientId } } } : {}),
          date,
          montantBrut:  montantTotal,
          montantTotal: montantFinal,
          remiseMontant: remise,
          remisePct:    remise > 0 ? 5 : 0,
          modePaiement: mode,
          splitPaiement: false,
          lignes: {
            create: lignesChoisies.map(l => ({
              produitId:    l.produit.id,
              quantite:     l.qte,
              prixUnitaire: l.produit.prixVente,
              sousTotal:    l.produit.prixVente * l.qte,
            })),
          },
        },
      });
      nbVentes++;
    }
  }
  console.log(`✓ ${nbVentes} ventes créées`);

  // ── 12. Pertes ────────────────────────────────────────────────────────────────
  console.log("\n🗑️  Création des pertes...");
  let nbPertes = 0;

  for (let j = 0; j < 30; j++) {
    if (rand(0, 1) === 1) continue; // 1 jour sur 2

    const date = dateIl_y_a(j, 19); // fin de journée

    // Pertes produits invendus
    const prodPertes = [pBaguette, pBagSpec, pCroissant, pFondant];
    const pPerte = pick(prodPertes);
    const qte    = rand(2, 10);
    await prisma.perte.create({ data: {
      company: { connect: { id: company.id } },
      type: "PRODUIT_FINI",
      produit: { connect: { id: pPerte.id } },
      quantite: qte,
      valeur: Math.round(pPerte.prixVente * qte * 0.4), // coût estimé
      cause: pick(["Invendu fin de journée", "DLV dépassé", "Mauvaise cuisson", "Chute"]),
      deductMP: false,
      date,
    }});
    nbPertes++;

    // Perte MP occasionnelle
    if (rand(0, 4) === 0) {
      await prisma.perte.create({ data: {
        company: { connect: { id: company.id } },
        type: "MATIERE_PREMIERE",
        mp: { connect: { id: pick([farine55.id, beurre.id, lait.id]) } },
        quantite: randF(0.5, 3),
        valeur: rand(500, 3000),
        cause: pick(["Rupture sac", "Péremption", "Contamination", "Renversement"]),
        deductMP: true,
        date,
      }});
      nbPertes++;
    }
  }
  console.log(`✓ ${nbPertes} pertes créées`);

  // ── 13. Commandes clients ─────────────────────────────────────────────────────
  console.log("\n📋 Création des commandes clients...");

  const commandesClients = await Promise.all([
    // Commande en cours
    prisma.commandeClient.create({ data: {
      company: { connect: { id: company.id } },
      client:  { connect: { id: clients[0].id } }, // Hôtel Ivoire Palace
      reference: "CMD-2025-001",
      dateLivraison: dateIl_y_a(-3, 10), // dans 3 jours
      statut: "EN_PRODUCTION",
      acompte: 25000,
      montantTotal: 85000,
      notes: "Livraison à l'entrée cuisine, demander M. Bah",
      lignes: {
        create: [
          { produitId: pBaguette.id, quantite: 100, prixUnitaire: 250, sousTotal: 25000 },
          { produitId: pCroissant.id, quantite: 50, prixUnitaire: 400, sousTotal: 20000 },
          { produitId: pPainMie.id,   quantite: 30, prixUnitaire: 850, sousTotal: 25500 },
          { produitId: pPainChoco.id, quantite: 32, prixUnitaire: 450, sousTotal: 14400 },
        ],
      },
    }}),
    // Commande prête
    prisma.commandeClient.create({ data: {
      company: { connect: { id: company.id } },
      client:  { connect: { id: clients[2].id } }, // Koné Marie-Claire
      reference: "CMD-2025-002",
      dateLivraison: dateIl_y_a(-1, 14),
      statut: "PRETE",
      acompte: 9000,
      montantTotal: 18000,
      notes: "Gâteau d'anniversaire pour 10 personnes, écriture : Joyeux Anniversaire Papa",
      lignes: {
        create: [
          { produitId: pGateau.id, quantite: 1, prixUnitaire: 18000, sousTotal: 18000 },
        ],
      },
    }}),
    // Commande reçue récente
    prisma.commandeClient.create({ data: {
      company: { connect: { id: company.id } },
      client:  { connect: { id: clients[3].id } }, // École Sainte-Marie
      reference: "CMD-2025-003",
      dateLivraison: dateIl_y_a(-5, 8),
      statut: "RECUE",
      acompte: 15000,
      montantTotal: 42000,
      lignes: {
        create: [
          { produitId: pBaguette.id,  quantite: 80,  prixUnitaire: 250, sousTotal: 20000 },
          { produitId: pPainChoco.id, quantite: 40,  prixUnitaire: 450, sousTotal: 18000 },
          { produitId: pBrioche.id,   quantite: 10,  prixUnitaire: 350, sousTotal: 3500 },
          { produitId: pCroissant.id, quantite: 2,   prixUnitaire: 400, sousTotal: 800 },
        ],
      },
    }}),
    // Commande livrée
    prisma.commandeClient.create({ data: {
      company: { connect: { id: company.id } },
      client:  { connect: { id: clients[5].id } }, // Festin d'Or
      reference: "CMD-2025-004",
      dateLivraison: dateIl_y_a(7, 10),
      statut: "LIVREE",
      acompte: 50000,
      montantTotal: 120000,
      notes: "Mariage — 200 personnes. Livrée OK.",
      lignes: {
        create: [
          { produitId: pGateau.id,    quantite: 4,   prixUnitaire: 18000, sousTotal: 72000 },
          { produitId: pCroissant.id, quantite: 80,  prixUnitaire: 400,   sousTotal: 32000 },
          { produitId: pKouign.id,    quantite: 10,  prixUnitaire: 1500,  sousTotal: 15000 },
        ],
      },
    }}),
    // Commande annulée
    prisma.commandeClient.create({ data: {
      company: { connect: { id: company.id } },
      client:  { connect: { id: clients[1].id } },
      reference: "CMD-2025-005",
      dateLivraison: dateIl_y_a(10, 9),
      statut: "ANNULEE",
      acompte: 0,
      montantTotal: 35000,
      notes: "Annulée par le client — changement de date",
      lignes: {
        create: [
          { produitId: pFondant.id,   quantite: 20,  prixUnitaire: 1200,  sousTotal: 24000 },
          { produitId: pEclair.id,    quantite: 18,  prixUnitaire: 600,   sousTotal: 10800 },
        ],
      },
    }}),
  ]);
  console.log(`✓ ${commandesClients.length} commandes clients créées`);

  // ── 14. Commandes fournisseurs ────────────────────────────────────────────────
  console.log("\n🚚 Création des commandes fournisseurs...");

  await Promise.all([
    // Envoyée (en attente)
    prisma.commandeFournisseur.create({ data: {
      company:      { connect: { id: company.id } },
      fournisseur:  { connect: { id: fournGB.id } },
      userId: responsable.id,
      reference: "CF-2025-008",
      statut: "ENVOYEE",
      dateCommande: dateIl_y_a(2),
      dateLivraisonPrevue: dateIl_y_a(-1),
      montantTotal: 425000,
      notes: "Commande mensuelle habituelle",
      lignes: {
        create: [
          { mpId: farine55.id,  quantite: 200, prixUnitaire: 850,  sousTotal: 170000, quantiteRecue: 0 },
          { mpId: farineT45.id, quantite: 100, prixUnitaire: 950,  sousTotal: 95000,  quantiteRecue: 0 },
          { mpId: farineCpl.id, quantite: 100, prixUnitaire: 780,  sousTotal: 78000,  quantiteRecue: 0 },
          { mpId: levure.id,    quantite: 10,  prixUnitaire: 1200, sousTotal: 12000,  quantiteRecue: 0 },
          { mpId: sel.id,       quantite: 50,  prixUnitaire: 200,  sousTotal: 10000,  quantiteRecue: 0 },
        ],
      },
    }}),
    // Reçue
    prisma.commandeFournisseur.create({ data: {
      company:      { connect: { id: company.id } },
      fournisseur:  { connect: { id: fournLait.id } },
      userId: responsable.id,
      reference: "CF-2025-007",
      statut: "RECUE",
      dateCommande: dateIl_y_a(8),
      dateLivraisonPrevue: dateIl_y_a(6),
      montantTotal: 187500,
      lignes: {
        create: [
          { mpId: beurre.id,  quantite: 30,  prixUnitaire: 3200, sousTotal: 96000,  quantiteRecue: 30 },
          { mpId: lait.id,    quantite: 80,  prixUnitaire: 650,  sousTotal: 52000,  quantiteRecue: 80 },
          { mpId: oeufs.id,   quantite: 6,   prixUnitaire: 4500, sousTotal: 27000,  quantiteRecue: 6 },
          { mpId: creme.id,   quantite: 2.5, prixUnitaire: 4800, sousTotal: 12000,  quantiteRecue: 2.5 },
        ],
      },
    }}),
    // Brouillon
    prisma.commandeFournisseur.create({ data: {
      company:      { connect: { id: company.id } },
      fournisseur:  { connect: { id: fournOil.id } },
      userId: gestionnaire.id,
      reference: "CF-2025-009",
      statut: "BROUILLON",
      dateCommande: dateIl_y_a(0),
      dateLivraisonPrevue: dateIl_y_a(-5),
      montantTotal: 162000,
      lignes: {
        create: [
          { mpId: margarine.id, quantite: 50, prixUnitaire: 1800, sousTotal: 90000, quantiteRecue: 0 },
          { mpId: huile.id,     quantite: 20, prixUnitaire: 1200, sousTotal: 24000, quantiteRecue: 0 },
          { mpId: beurre.id,    quantite: 15, prixUnitaire: 3200, sousTotal: 48000, quantiteRecue: 0 },
        ],
      },
    }}),
  ]);
  console.log(`✓ 3 commandes fournisseurs créées`);

  // ── 15. Clôtures des 7 derniers jours ─────────────────────────────────────────
  console.log("\n🔒 Création des clôtures journées...");

  for (let j = 1; j <= 7; j++) {
    const date = dateIl_y_a(j, 0);
    const caJour   = rand(85000, 180000);
    const nbTrans  = rand(18, 45);
    const especes  = Math.round(caJour * 0.55);
    const mobile   = Math.round(caJour * 0.32);
    const credit   = caJour - especes - mobile;

    await prisma.cloturJournee.create({ data: {
      company: { connect: { id: company.id } },
      user:    { connect: { id: pick([admin.id, caissier.id]) } },
      date,
      heureRealisation: dateIl_y_a(j, 19),
      caTotal:       caJour,
      nbTransactions: nbTrans,
      totalEspeces:  especes,
      totalMobile:   mobile,
      totalCarte:    0,
      totalVirement: 0,
      totalCredit:   credit,
      nbInvendus:    rand(2, 8),
      valeurInvendus: rand(1000, 5000),
      nbPertes:      rand(0, 3),
      valeurPertes:  rand(0, 2000),
      fondCaisse:    rand(15000, 25000),
      ecartFond:     rand(-500, 500),
      notes:         j === 3 ? "Bonne journée, pic de ventes à 12h et 18h" : null,
    }});
  }
  console.log(`✓ 7 clôtures créées (J-1 à J-7)`);

  // ── Résumé final ─────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("✅ SEED TERMINÉ AVEC SUCCÈS !");
  console.log("=".repeat(60));
  console.log("\n🔑 COMPTES DE CONNEXION (mot de passe : Delice2025!)");
  console.log("─".repeat(45));
  console.log("  Admin     : admin@delice-abidjan.ci");
  console.log("  Responsable: responsable@delice-abidjan.ci");
  console.log("  Chef      : chef@delice-abidjan.ci");
  console.log("  Caissier  : caissier@delice-abidjan.ci");
  console.log("  Gestion   : gestion@delice-abidjan.ci");
  console.log("\n📦 DONNÉES CRÉÉES");
  console.log("─".repeat(45));
  console.log(`  Entreprise     : La Délice d'Abidjan`);
  console.log(`  Utilisateurs   : 5`);
  console.log(`  Catégories     : 10 (5 produits + 5 MP)`);
  console.log(`  Unités         : 6`);
  console.log(`  Fournisseurs   : 4`);
  console.log(`  Matières prem. : ${mps.length}`);
  console.log(`  Recettes       : 5`);
  console.log(`  Produits finis : ${produits.length - 1} + 1 semi-fini`);
  console.log(`  Clients        : ${clients.length}`);
  console.log(`  Productions    : 30 jours`);
  console.log(`  Ventes         : ~${nbVentes} (30 jours)`);
  console.log(`  Pertes         : ~${nbPertes}`);
  console.log(`  Cmdes clients  : ${commandesClients.length}`);
  console.log(`  Cmdes fourn.   : 3`);
  console.log(`  Clôtures       : 7 jours`);
  console.log("\n💡 OBJECTIFS CONFIGURÉS");
  console.log("─".repeat(45));
  console.log(`  Objectif CA/jour  : 150 000 FCFA`);
  console.log(`  Seuil pertes      : 10 000 FCFA`);
  console.log(`  Charges mensuelles: 800 000 FCFA`);
  console.log(`  Heure clôture     : 19h00`);
  console.log("=".repeat(60));
}

main()
  .catch(e => {
    console.error("\n❌ Erreur seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  