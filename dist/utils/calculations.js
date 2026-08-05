"use strict";
// ═══════════════════════════════════════════════════════════════
// src/utils/calculations.ts — Calculs métier Delice Pro
// ═══════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculerCoutRecette = calculerCoutRecette;
exports.calculerMargeProduit = calculerMargeProduit;
exports.calculerNombrePieces = calculerNombrePieces;
exports.calculerPateTheorique = calculerPateTheorique;
exports.calculerEcartProduction = calculerEcartProduction;
exports.deduireStockMP = deduireStockMP;
exports.calculerImpactMPProduitPerdu = calculerImpactMPProduitPerdu;
const database_1 = __importDefault(require("../config/database"));
// ─── Coût MP total d'une recette (pour 1 kg de farine) ─────────
// Somme de : quantité_ingrédient × prix_achat_MP
// Les quantités sont définies PAR kg de farine dans la recette
async function calculerCoutRecette(recetteId) {
    const recette = await database_1.default.recette.findUnique({
        where: { id: recetteId },
        include: {
            ingredients: {
                include: { mp: true, unite: true },
            },
        },
    });
    if (!recette)
        return 0;
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
async function calculerMargeProduit(produitId) {
    const produit = await database_1.default.produit.findUnique({
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
function calculerNombrePieces(pateReelleKg, grammageGrammes) {
    if (grammageGrammes <= 0)
        return 0;
    return Math.floor((pateReelleKg * 1000) / grammageGrammes);
}
// ─── Calcul de la pâte théorique ───────────────────────────────
function calculerPateTheorique(quantiteFarine, ratioPate) {
    return Math.round(quantiteFarine * ratioPate * 100) / 100;
}
// ─── Calcul de l'écart de production ───────────────────────────
function calculerEcartProduction(pateTheorique, pateReelle) {
    const ecartKg = Math.round((pateReelle - pateTheorique) * 100) / 100;
    const ecartPct = pateTheorique > 0
        ? Math.round((ecartKg / pateTheorique) * 10000) / 100
        : 0;
    return { ecartKg, ecartPct };
}
// ─── Déduire le stock d'une MP ──────────────────────────────────
async function deduireStockMP(mpId, quantite, typeMouvement, motif) {
    await database_1.default.$transaction([
        database_1.default.matierePremiere.update({
            where: { id: mpId },
            data: { stockActuel: { decrement: quantite } },
        }),
        database_1.default.mouvementStock.create({
            data: { mpId, type: typeMouvement, quantite: -quantite, motif: motif ?? "Déduction automatique" },
        }),
    ]);
}
// ─── Impact MP d'une perte produit fini ────────────────────────
async function calculerImpactMPProduitPerdu(produitId, quantite) {
    const produit = await database_1.default.produit.findUnique({
        where: { id: produitId },
        include: {
            recette: { include: { ingredients: { include: { mp: true, unite: true } } } },
        },
    });
    if (!produit?.recette)
        return [];
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
//# sourceMappingURL=calculations.js.map