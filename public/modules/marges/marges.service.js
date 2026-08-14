"use strict";
// src/modules/marges/marges.service.ts
//
// CORRECTIONS :
// ─────────────────────────────────────────────────────────────────────────────
// FIX 1 : Calcul coût viennoiserie suit la logique pâton SAELIA
//         coût/pièce = (coût pétrin ÷ nb pâtons) + (prix beurre × 1kg ÷ 100 pièces)
// FIX 2 : Détection viennoiserie par flag 'estViennoiserie' sur recette (plus fiable)
//         Fallback sur le nom si le flag absent
// FIX 3 : Explication claire marge commerciale vs taux de marque dans le retour
// FIX 4 : seuilMini par défaut adapté selon la catégorie (60% boulangerie, 25% revendu)
// FIX 5 : mode:"insensitive" retiré conditionnellement — incompatible avec SQLite
//         (mode desktop). PostgreSQL en a besoin (sensible à la casse par défaut),
//         SQLite non (déjà insensible à la casse par défaut sur "contains").
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculerCoutRevient = calculerCoutRevient;
exports.getMargesTousProduits = getMargesTousProduits;
exports.getMargesParCategorie = getMargesParCategorie;
exports.simulerImpactHausse = simulerImpactHausse;
const database_1 = __importDefault(require("../../config/database"));
const env_1 = require("../../config/env");
// SQLite (mode DESKTOP) ne supporte pas mode:"insensitive" — et n'en a pas
// besoin, ses recherches "contains" sont déjà insensibles à la casse par
// défaut. PostgreSQL (mode SAAS), lui, est sensible à la casse par défaut,
// donc ce paramètre y reste nécessaire pour garder le même comportement
// (trouver "Beurre" en cherchant "beurre").
const modeInsensible = env_1.env.DEPLOY_MODE === "DESKTOP" ? {} : { mode: "insensitive" };
// ─── Seuil de marge par défaut selon le type de produit ──────────────────────
// En boulangerie, les MP représentent 5-15% du prix de vente → marge MP = 85-95%
// Le seuil "minimum" doit être calibré pour alerter sur les vrais problèmes
function seuilDefaut(produit) {
    // 1. Seuil explicitement défini sur le produit → toujours prioritaire
    if (produit.margeMin != null && produit.margeMin > 0)
        return produit.margeMin;
    // 2. Seuil défini sur la catégorie
    if (produit.categorie?.margeMin != null && produit.categorie.margeMin > 0)
        return produit.categorie.margeMin;
    // 3. Seuil par défaut selon le type
    if (produit.prixAchat > 0 && !produit.recette)
        return 25; // Produit revendu
    if (produit.estSemiFini)
        return 50; // Semi-fini
    return 60; // FIX 4 : boulangerie/pâtisserie → 60% par défaut (plus réaliste)
}
// ─── Calcul coût de revient ───────────────────────────────────────────────────
function calculerCoutRevient(produit, beurreMP) {
    const recette = produit.recette;
    const grammage = produit.grammage;
    // ── CAS 1 : Produit revendu (prixAchat défini, pas de recette)
    if (!recette && (produit.prixAchat ?? 0) > 0) {
        return {
            coutRevient: produit.prixAchat,
            coutMP1unite: produit.prixAchat,
            piecesParUniteRef: 1,
            refNom: "Prix achat",
            refUnite: "unité",
            detailIngredients: [{
                    nom: "Prix d'achat fournisseur",
                    quantite: 1, unite: "unité",
                    prixUnitaire: produit.prixAchat,
                    cout: produit.prixAchat,
                    pctDuCout: 100,
                    nonGere: false,
                }],
            aGrammage: grammage > 0,
            source: "PRIX_ACHAT",
            methodeCout: "Produit revendu — coût = prix d'achat fournisseur",
        };
    }
    // ── CAS 2 : Incomplet (ni recette ni prix achat ni grammage)
    if (!recette || !grammage || grammage <= 0) {
        return {
            coutRevient: 0, coutMP1unite: 0, piecesParUniteRef: 0,
            refNom: "—", refUnite: "—", detailIngredients: [],
            aGrammage: false, source: "AUCUN",
            methodeCout: "Données manquantes : recette ou grammage non défini",
        };
    }
    // ── CAS 3 : Produit fabriqué avec recette
    const refNom = recette.ingredientReferenceNom ?? "Farine";
    const refUnite = recette.ingredientReferenceUnite ?? "kg";
    // FIX 2 : Détection viennoiserie — flag en priorité, puis nom
    const isViennoiserie = recette.estViennoiserie === true ||
        recette.categorie?.toLowerCase().includes("vienno") ||
        recette.categorie?.toLowerCase().includes("feuillet") ||
        recette.nom?.toLowerCase().includes("croissant") ||
        recette.nom?.toLowerCase().includes("pain au chocolat") ||
        recette.nom?.toLowerCase().includes("pain choco") ||
        recette.nom?.toLowerCase().includes("brioche") ||
        recette.nom?.toLowerCase().includes("pain au raisin") ||
        recette.nom?.toLowerCase().includes("pain suisse");
    // Coût MP pour 1 unité de référence (hors beurre de façonnage)
    let coutMP1unite = 0;
    const ingredientsAvecCout = recette.ingredients.map((ing) => {
        const coeff = ing.unite?.coefficient ?? 1;
        const nonGere = ing.mp?.stockGere === false || (ing.mp?.prixAchat ?? 0) === 0;
        const cout = nonGere ? 0 : ing.quantite * coeff * (ing.mp?.prixAchat ?? 0);
        if (!nonGere)
            coutMP1unite += cout;
        return { ing, cout, nonGere };
    });
    const tauxPerte = recette.tauxPerte ?? 0;
    const pateUtileGrammes = recette.ratioPate * (1 - tauxPerte / 100) * 1000;
    const piecesParUniteRef = pateUtileGrammes / grammage;
    // ── FIX 1 : Calcul viennoiserie — méthode pâton SAELIA ──────────────────────
    // Selon votre document SAELIA (Croissant Choco) :
    //   Recette pétrissage : 50 kg farine → coût 32 688 F → 20.71 pâtons
    //   Coût par pâton     = 32 688 ÷ 20.71 = 1 578.65 F
    //   Façonnage          : 1 pâton + 1 kg beurre → 100 croissants
    //   Coût beurre/pièce  = 6 838.98 ÷ 100 = 68.39 F
    //   Coût total/pièce   = 1 578.65 ÷ 100 + 68.39 = 84.17 F
    let coutRevient;
    let methodeCout;
    const detailFinal = [...ingredientsAvecCout];
    if (isViennoiserie) {
        // Référence SAELIA : poids moyen d'un pâton
        const POIDS_PATON_KG = 4.5; // Référence standard SAELIA
        const PIECES_PAR_PATON = 100; // Référence standard SAELIA (croissants)
        const BEURRE_PAR_PATON = 1; // 1 kg beurre par pâton
        // Nombre de pâtons par unité de référence
        const nbPatonsParUniteRef = pateUtileGrammes / 1000 / POIDS_PATON_KG;
        // Coût MP du pétrin par pâton
        const coutPetrinParPaton = nbPatonsParUniteRef > 0
            ? coutMP1unite / nbPatonsParUniteRef
            : 0;
        // Coût beurre de façonnage par pièce
        const prixBeurreReel = beurreMP?.prixAchat ?? 0;
        const coutBeurreParPiece = prixBeurreReel > 0
            ? (prixBeurreReel * BEURRE_PAR_PATON) / PIECES_PAR_PATON
            : 0;
        // Coût total par pièce = (coût pétrin par pâton ÷ pièces/pâton) + beurre/pièce
        const coutPetrinParPiece = PIECES_PAR_PATON > 0
            ? coutPetrinParPaton / PIECES_PAR_PATON
            : 0;
        coutRevient = Math.round((coutPetrinParPiece + coutBeurreParPiece) * 100) / 100;
        methodeCout = `Méthode pâton SAELIA : coût pétrin (${Math.round(coutPetrinParPaton)} F/pâton) ÷ ${PIECES_PAR_PATON} pièces + beurre façonnage (${Math.round(coutBeurreParPiece)} F/pièce)`;
        // Ajouter le beurre dans le détail si prix disponible
        if (prixBeurreReel > 0) {
            const beurreDejaInRecette = recette.ingredients.some((ing) => ing.mp?.nom?.toLowerCase().includes("beurre") ||
                ing.mp?.nom?.toLowerCase().includes("margarine"));
            if (!beurreDejaInRecette) {
                detailFinal.push({
                    ing: {
                        mp: { nom: `Beurre façonnage (${beurreMP.nom})`, prixAchat: prixBeurreReel },
                        quantite: BEURRE_PAR_PATON,
                        unite: { abreviation: "kg" },
                    },
                    cout: Math.round(prixBeurreReel * BEURRE_PAR_PATON * 100) / 100,
                    nonGere: false,
                });
                coutMP1unite += prixBeurreReel * BEURRE_PAR_PATON;
            }
        }
        else {
            methodeCout += ` (⚠ beurre non trouvé dans les MP — coût sous-estimé)`;
        }
    }
    else {
        // ── CAS STANDARD : boulangerie / pâtisserie ──────────────────────────────
        coutRevient = piecesParUniteRef > 0
            ? Math.round((coutMP1unite / piecesParUniteRef) * 100) / 100
            : 0;
        methodeCout = `Coût MP par ${refUnite} ${refNom} (${Math.round(coutMP1unite)} F) ÷ ${Math.round(piecesParUniteRef * 100) / 100} pièces`;
    }
    // Détail par ingrédient avec % du coût
    const coutTotalDetail = detailFinal.reduce((s, x) => s + x.cout, 0);
    const detailIngredients = detailFinal.map(({ ing, cout, nonGere }) => ({
        nom: ing.mp?.nom ?? "—",
        quantite: Math.round((ing.quantite ?? 0) * 1000) / 1000,
        unite: ing.unite?.abreviation ?? "kg",
        prixUnitaire: ing.mp?.prixAchat ?? 0,
        cout: Math.round(cout * 100) / 100,
        pctDuCout: coutTotalDetail > 0
            ? Math.round((cout / coutTotalDetail) * 10000) / 100
            : 0,
        nonGere,
    }));
    return {
        coutRevient,
        coutMP1unite: Math.round(coutMP1unite * 100) / 100,
        piecesParUniteRef: Math.round(piecesParUniteRef * 100) / 100,
        refNom, refUnite,
        detailIngredients,
        aGrammage: true,
        source: isViennoiserie ? "RECETTE_VIENNOISERIE" : "RECETTE",
        methodeCout,
    };
}
// ─── Prix conseillé pour atteindre la marge minimale ─────────────────────────
function prixConseille(coutRevient, margeMin) {
    if (coutRevient <= 0 || margeMin <= 0 || margeMin >= 100)
        return null;
    // Formule marge commerciale : prixVente = coût ÷ (1 - margeMin/100)
    return Math.ceil(coutRevient / (1 - margeMin / 100));
}
// ─── Tous les produits ────────────────────────────────────────────────────────
async function getMargesTousProduits(companyId) {
    const produits = await database_1.default.produit.findMany({
        where: { companyId, actif: true },
        include: {
            categorie: { select: { id: true, nom: true, margeMin: true } },
            recette: {
                select: {
                    id: true, nom: true, ratioPate: true, tauxPerte: true,
                    categorie: true,
                    estViennoiserie: true, // FIX 2 : flag explicite
                    ingredientReference: true,
                    ingredientReferenceNom: true,
                    ingredientReferenceUnite: true,
                    ingredients: {
                        include: {
                            mp: { select: { id: true, nom: true, prixAchat: true, stockGere: true } },
                            unite: { select: { abreviation: true, coefficient: true } },
                        },
                    },
                },
            },
        },
        orderBy: { nom: "asc" },
    });
    // Beurre réel pour la viennoiserie
    const beurreMP = await database_1.default.matierePremiere.findFirst({
        where: { companyId, nom: { contains: "beurre" }, actif: true },
        select: { id: true, nom: true, prixAchat: true },
        orderBy: { prixAchat: "desc" },
    });
    const marges = produits.map((produit) => {
        const seuilMini = seuilDefaut(produit); // FIX 4 : seuil adapté
        const calc = calculerCoutRevient(produit, beurreMP);
        if (calc.source === "AUCUN") {
            return {
                id: produit.id, nom: produit.nom,
                categorie: produit.categorie?.nom ?? "Non classé",
                prixVente: produit.prixVente,
                prixAchat: produit.prixAchat ?? 0,
                grammage: produit.grammage,
                recette: produit.recette?.nom ?? null,
                tauxPerte: produit.recette?.tauxPerte ?? 0,
                refNom: "—", refUnite: "—",
                coutRevient: null, coutMP1unite: null, detailIngredients: [],
                piecesParUniteRef: null,
                margeValeur: null, margePct: null, tauxMarque: null,
                seuilMini, statut: "INCOMPLET",
                prixConseille: null, aGrammage: false,
                source: "AUCUN", methodeCout: calc.methodeCout,
            };
        }
        const { coutRevient, coutMP1unite, piecesParUniteRef, refNom, refUnite, detailIngredients, aGrammage, source, methodeCout } = calc;
        const margeValeur = Math.round((produit.prixVente - coutRevient) * 100) / 100;
        const margePct = produit.prixVente > 0
            ? Math.round((margeValeur / produit.prixVente) * 10000) / 100
            : 0;
        // FIX 3 : Taux de marque = marge ÷ coût (différent de marge ÷ prix vente)
        const tauxMarque = coutRevient > 0
            ? Math.round((margeValeur / coutRevient) * 10000) / 100
            : null;
        const statut = margePct >= seuilMini * 1.2 ? "OK"
            : margePct >= seuilMini ? "ACCEPTABLE"
                : "ALERTE";
        return {
            id: produit.id, nom: produit.nom,
            categorie: produit.categorie?.nom ?? "Non classé",
            prixVente: produit.prixVente,
            prixAchat: produit.prixAchat ?? 0,
            grammage: produit.grammage,
            recette: produit.recette?.nom ?? null,
            tauxPerte: produit.recette?.tauxPerte ?? 0,
            refNom, refUnite,
            coutRevient,
            coutMP1unite,
            detailIngredients,
            piecesParUniteRef,
            margeValeur, margePct, tauxMarque,
            seuilMini, statut,
            prixConseille: statut === "ALERTE" ? prixConseille(coutRevient, seuilMini) : null,
            aGrammage, source, methodeCout,
        };
    });
    const avecMarge = marges.filter((m) => m.margePct !== null);
    const margeMoyenne = avecMarge.length > 0
        ? avecMarge.reduce((s, m) => s + (m.margePct ?? 0), 0) / avecMarge.length
        : 0;
    const sorted = [...avecMarge].sort((a, b) => (b.margePct ?? 0) - (a.margePct ?? 0));
    const enAlerte = avecMarge.filter((m) => m.statut === "ALERTE");
    const incomplets = marges.filter((m) => m.source === "AUCUN");
    return {
        produits: marges,
        beurreMP: beurreMP ? { nom: beurreMP.nom, prixAchat: beurreMP.prixAchat } : null,
        stats: {
            margeMoyenne: Math.round(margeMoyenne * 100) / 100,
            plusRentable: sorted[0] ?? null,
            moinsRentable: sorted[sorted.length - 1] ?? null,
            nbEnAlerte: enAlerte.length,
            nbIncomplets: incomplets.length,
            enAlerte,
        },
    };
}
// ─── Marges par catégorie ─────────────────────────────────────────────────────
async function getMargesParCategorie(companyId) {
    const beurreMP = await database_1.default.matierePremiere.findFirst({
        where: { companyId, nom: { contains: "beurre", ...modeInsensible }, actif: true },
        select: { prixAchat: true },
        orderBy: { prixAchat: "desc" },
    });
    const categories = await database_1.default.categorie.findMany({
        where: { companyId, type: "PRODUIT" },
        include: {
            produits: {
                where: { actif: true },
                include: {
                    recette: {
                        select: {
                            ratioPate: true, tauxPerte: true, categorie: true, nom: true,
                            estViennoiserie: true,
                            ingredientReferenceNom: true, ingredientReferenceUnite: true,
                            ingredients: {
                                include: {
                                    mp: { select: { prixAchat: true, stockGere: true } },
                                    unite: { select: { coefficient: true } },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    return categories
        .filter((cat) => cat.produits.length > 0)
        .map((cat) => {
        const margeMin = cat.margeMin ?? 60;
        const margesAvecPrix = cat.produits
            .filter((p) => (p.grammage ?? 0) > 0)
            .map((p) => {
            const calc = calculerCoutRevient(p, beurreMP);
            if (!calc.aGrammage || calc.source === "AUCUN")
                return null;
            const margeValeur = p.prixVente - calc.coutRevient;
            return p.prixVente > 0 ? (margeValeur / p.prixVente) * 100 : 0;
        })
            .filter((m) => m !== null);
        const margeMoyenne = margesAvecPrix.length > 0
            ? margesAvecPrix.reduce((s, m) => s + m, 0) / margesAvecPrix.length
            : 0;
        const statut = margesAvecPrix.length === 0 ? "INCOMPLET"
            : margeMoyenne >= margeMin * 1.2 ? "OK"
                : margeMoyenne >= margeMin ? "ACCEPTABLE"
                    : "ALERTE";
        return {
            id: cat.id, nom: cat.nom,
            nbProduits: cat.produits.length,
            nbAvecMarge: margesAvecPrix.length,
            margeMoyenne: Math.round(margeMoyenne * 100) / 100,
            margeMin, statut,
        };
    });
}
// ─── Simulateur impact hausse MP ──────────────────────────────────────────────
async function simulerImpactHausse(companyId, variations) {
    if (variations.length === 0)
        return { produits: [] };
    const mpsIds = variations.map(v => v.mpId);
    const mps = await database_1.default.matierePremiere.findMany({
        where: { id: { in: mpsIds }, companyId },
        select: { id: true, nom: true, prixAchat: true },
    });
    const nouveauxPrix = new Map(mps.map((mp) => {
        const variation = variations.find((v) => v.mpId === mp.id);
        const nouveauPrix = mp.prixAchat * (1 + (variation?.variation ?? 0) / 100);
        return [mp.id, { nom: mp.nom, ancienPrix: mp.prixAchat, nouveauPrix }];
    }));
    const produits = await database_1.default.produit.findMany({
        where: {
            companyId, actif: true,
            recette: { ingredients: { some: { mpId: { in: mpsIds } } } },
        },
        include: {
            recette: {
                select: {
                    ratioPate: true, tauxPerte: true, categorie: true, nom: true,
                    estViennoiserie: true,
                    ingredientReferenceNom: true, ingredientReferenceUnite: true,
                    ingredients: {
                        include: {
                            mp: { select: { id: true, nom: true, prixAchat: true, stockGere: true } },
                            unite: { select: { coefficient: true } },
                        },
                    },
                },
            },
        },
    });
    const beurreMP = await database_1.default.matierePremiere.findFirst({
        where: { companyId, nom: { contains: "beurre", ...modeInsensible } },
        select: { prixAchat: true, nom: true },
        orderBy: { prixAchat: "desc" },
    });
    return {
        produits: produits.map((p) => {
            const avant = calculerCoutRevient(p, beurreMP);
            const seuilMini = seuilDefaut(p);
            const margeAvant = p.prixVente > 0
                ? Math.round(((p.prixVente - avant.coutRevient) / p.prixVente) * 10000) / 100
                : 0;
            const pModifie = {
                ...p,
                recette: {
                    ...p.recette,
                    ingredients: p.recette.ingredients.map((ing) => ({
                        ...ing,
                        mp: nouveauxPrix.has(ing.mp.id)
                            ? { ...ing.mp, prixAchat: nouveauxPrix.get(ing.mp.id).nouveauPrix }
                            : ing.mp,
                    })),
                },
            };
            // Si beurre est une des MP modifiées, appliquer aussi
            const beurreModifie = beurreMP && nouveauxPrix.has(beurreMP.id)
                ? { ...beurreMP, prixAchat: nouveauxPrix.get(beurreMP.id).nouveauPrix }
                : beurreMP;
            const apres = calculerCoutRevient(pModifie, beurreModifie);
            const margeApres = p.prixVente > 0
                ? Math.round(((p.prixVente - apres.coutRevient) / p.prixVente) * 10000) / 100
                : 0;
            return {
                id: p.id, nom: p.nom,
                prixVente: p.prixVente,
                seuilMini,
                coutAvant: avant.coutRevient,
                coutApres: apres.coutRevient,
                margeAvant, margeApres,
                deltaMarke: Math.round((margeApres - margeAvant) * 100) / 100,
                deltaCout: Math.round((apres.coutRevient - avant.coutRevient) * 100) / 100,
                passeEnAlerte: margeApres < seuilMini && margeAvant >= seuilMini,
                impacteParMPs: p.recette?.ingredients
                    .filter((ing) => nouveauxPrix.has(ing.mp.id))
                    .map((ing) => nouveauxPrix.get(ing.mp.id).nom) ?? [],
            };
        }),
        variationsAppliquees: Array.from(nouveauxPrix.entries()).map(([id, data]) => ({
            mpId: id, ...data,
        })),
    };
}
//# sourceMappingURL=marges.service.js.map