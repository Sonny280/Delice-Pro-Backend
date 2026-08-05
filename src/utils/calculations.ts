// ═══════════════════════════════════════════════════════════════
// src/utils/calculations.ts — Calculs métier Delice Pro
// ═══════════════════════════════════════════════════════════════

import prisma from "../config/database";

// ─── Coût MP total d'une recette (pour 1 kg de farine) ─────────
// Somme de : quantité_ingrédient × prix_achat_MP
// Les quantités sont définies PAR kg de farine dans la recette
export async function calculerCoutRecette(recetteId: string): Promise<number> {
  const recette = await prisma.recette.findUnique({
    where: { id: recetteId },
    include: {
      ingredients: {
        include: { mp: true, unite: true },
      },
    },
  });
  if (!recette) return 0;

  let coutTotal = 0;
  for (const ingredient of recette.ingredients) {
    const { mp, unite, quantite } = ingredient;
    const quantiteEnUniteBase = unite ? quantite * unite.coefficient : quantite;
    coutTotal += quantiteEnUniteBase * mp.prixAchat;
  }
  return Math.round(coutTotal * 100) / 100;
}

// ─── Calcul complet d'un produit avec grammage ─────────────────
// Retourne toutes les métriques financières d'un produit
//
// Exemple : Pain Blanc 300g, recette coef 1.82
//   Coût MP / kg farine     = 422 F
//   Pâte / kg farine        = 1820g  (1 kg × 1.82 × 1000)
//   Pièces / kg farine      = 1820 / 300 = 6.07 pièces
//   Coût revient / pièce    = 422 / 6.07 = 69.5 F
//   Prix vente              = 200 F
//   Marge brute             = 200 - 69.5 = 130.5 F
//   Marge %                 = 130.5 / 200 × 100 = 65.3%
export async function calculerMargeProduit(produitId: string): Promise<{
  coutMP: number;           // Coût MP pour 1 kg de farine
  coutParKgPate: number;    // Coût MP par kg de pâte
  coutRevient: number;      // Coût de revient par pièce
  piecesParKgFarine: number; // Nombre de pièces par kg de farine
  margeValeur: number;      // Marge brute par pièce (F)
  margePct: number;         // Marge en % du prix de vente
}> {
  const produit = await prisma.produit.findUnique({
    where: { id: produitId },
    include: { recette: true },
  });

  // Pas de recette ou pas de grammage → calcul simplifié
  if (!produit) {
    return { coutMP: 0, coutParKgPate: 0, coutRevient: 0, piecesParKgFarine: 0, margeValeur: 0, margePct: 0 };
  }

  if (!produit.recetteId) {
    return {
      coutMP: 0, coutParKgPate: 0, coutRevient: 0, piecesParKgFarine: 0,
      margeValeur: produit.prixVente, margePct: 100,
    };
  }

  // Coût MP pour 1 kg de farine
  const coutMP = await calculerCoutRecette(produit.recetteId);

  // Pâte obtenue pour 1 kg de farine (en grammes)
  const ratioPate = produit.recette?.ratioPate ?? 1;
  const pateParKgFarineEnGrammes = ratioPate * 1000;

  // Coût par kg de pâte
  const coutParKgPate = ratioPate > 0
    ? Math.round((coutMP / ratioPate) * 100) / 100
    : 0;

  // Si grammage défini → calcul précis par pièce
  if (produit.grammage && produit.grammage > 0) {
    const piecesParKgFarine = Math.round((pateParKgFarineEnGrammes / produit.grammage) * 100) / 100;
    const coutRevient = piecesParKgFarine > 0
      ? Math.round((coutMP / piecesParKgFarine) * 100) / 100
      : 0;
    const margeValeur = Math.round((produit.prixVente - coutRevient) * 100) / 100;
    const margePct = produit.prixVente > 0
      ? Math.round((margeValeur / produit.prixVente) * 10000) / 100
      : 0;

    return { coutMP, coutParKgPate, coutRevient, piecesParKgFarine, margeValeur, margePct };
  }

  // Pas de grammage → marge calculée sur la recette entière
  const margeValeur = Math.round((produit.prixVente - coutMP) * 100) / 100;
  const margePct = produit.prixVente > 0
    ? Math.round((margeValeur / produit.prixVente) * 10000) / 100
    : 0;

  return { coutMP, coutParKgPate, coutRevient: coutMP, piecesParKgFarine: 0, margeValeur, margePct };
}

// ─── Calcul du nombre de pièces pour une production donnée ─────
// pateReelleKg = pâte réellement obtenue (pesée après pétrissage)
// grammage     = poids d'une pièce en grammes
export function calculerNombrePieces(pateReelleKg: number, grammageGrammes: number): number {
  if (grammageGrammes <= 0) return 0;
  return Math.floor((pateReelleKg * 1000) / grammageGrammes);
}

// ─── Calcul de la pâte théorique ───────────────────────────────
export function calculerPateTheorique(quantiteFarine: number, ratioPate: number): number {
  return Math.round(quantiteFarine * ratioPate * 100) / 100;
}

// ─── Calcul de l'écart de production ───────────────────────────
export function calculerEcartProduction(
  pateTheorique: number, pateReelle: number
): { ecartKg: number; ecartPct: number } {
  const ecartKg = Math.round((pateReelle - pateTheorique) * 100) / 100;
  const ecartPct = pateTheorique > 0
    ? Math.round((ecartKg / pateTheorique) * 10000) / 100
    : 0;
  return { ecartKg, ecartPct };
}

// ─── Déduire le stock d'une MP ──────────────────────────────────
export async function deduireStockMP(
  mpId: string,
  quantite: number,
  typeMouvement: "SORTIE_PRODUCTION" | "SORTIE_PERTE_MP" | "SORTIE_PERTE_PRODUIT",
  motif?: string
): Promise<void> {
  await prisma.$transaction([
    prisma.matierePremiere.update({
      where: { id: mpId },
      data: { stockActuel: { decrement: quantite } },
    }),
    prisma.mouvementStock.create({
      data: { mpId, type: typeMouvement as any, quantite: -quantite, motif: motif ?? "Déduction automatique" },
    }),
  ]);
}

// ─── Impact MP d'une perte produit fini ────────────────────────
export async function calculerImpactMPProduitPerdu(
  produitId: string, quantite: number
): Promise<{ mpId: string; mpNom: string; quantiteADeduire: number }[]> {
  const produit = await prisma.produit.findUnique({
    where: { id: produitId },
    include: {
      recette: { include: { ingredients: { include: { mp: true, unite: true } } } },
    },
  });
  if (!produit?.recette) return [];

  return produit.recette.ingredients.map((ingredient) => {
    const quantiteParProduit = ingredient.quantite / 5;
    const quantiteADeduire = quantiteParProduit * quantite;
    const coefficient = ingredient.unite?.coefficient ?? 1;
    return {
      mpId: ingredient.mpId,
      mpNom: ingredient.mp.nom,
      quantiteADeduire: Math.round(quantiteADeduire * coefficient * 1000) / 1000,
    };
  });
}