"use strict";
// src/modules/recettes/recettes.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRecetteSchema = exports.createRecetteSchema = void 0;
exports.getRecettes = getRecettes;
exports.createRecette = createRecette;
exports.updateRecette = updateRecette;
exports.dupliquerRecette = dupliquerRecette;
exports.archiverRecette = archiverRecette;
const zod_1 = require("zod");
const database_1 = __importDefault(require("../../config/database"));
const error_middleware_1 = require("../../middleware/error.middleware");
const calculations_1 = require("../../utils/calculations");
// ─── Schémas ──────────────────────────────────────────────────────────────────
exports.createRecetteSchema = zod_1.z.object({
    nom: zod_1.z.string().min(2, "Le nom est requis (minimum 2 caractères)"),
    description: zod_1.z.string().optional(),
    ratioPate: zod_1.z.number().min(0.01, "Le coefficient doit être supérieur à 0").default(1.0),
    tauxPerte: zod_1.z.number().min(0, "Le taux de perte ne peut pas être négatif").max(100).default(0),
    categorie: zod_1.z.string().optional(),
    estViennoiserie: zod_1.z.boolean().optional().default(false),
    ingredientReference: zod_1.z.string().optional(),
    ingredientReferenceNom: zod_1.z.string().optional(),
    ingredientReferenceUnite: zod_1.z.string().optional(),
    ingredients: zod_1.z.array(zod_1.z.object({
        mpId: zod_1.z.string().optional().default(""),
        quantite: zod_1.z.number().min(0).default(0), // Accepte 0 — filtré après
        uniteId: zod_1.z.string().optional(),
    })).default([]), // Pas de min(1) — filtrage côté service
});
exports.updateRecetteSchema = exports.createRecetteSchema.partial();
// ─── Include standard ─────────────────────────────────────────────────────────
const includeComplet = {
    ingredients: {
        include: {
            mp: { select: { id: true, nom: true, prixAchat: true, unite: { select: { abreviation: true } } } },
            unite: { select: { id: true, nom: true, abreviation: true, coefficient: true } },
        },
    },
    produits: {
        select: { id: true, nom: true, prixVente: true, grammage: true, margeMin: true },
    },
};
// ─── Enrichir avec les calculs ────────────────────────────────────────────────
async function enrichir(recette) {
    const coutMP = await (0, calculations_1.calculerCoutRecette)(recette.id);
    const ratio = recette.ratioPate ?? 1;
    // Cout par kg de pate
    const coutParKgPate = ratio > 0 ? ((coutMP / ratio) * 100) / 100 : 0;
    // Calculs par produit
    const produitsAvecCalc = (recette.produits ?? []).map((p) => {
        if (!p.grammage || p.grammage <= 0)
            return { ...p, calc: null };
        const pateUtilisable = ratio * 1000 * (1 - (recette.tauxPerte ?? 0) / 100);
        //const piecesParKgFarine = Math.round((pateUtilisable / p.grammage) * 100) / 100;
        const piecesParKgFarine = ((pateUtilisable / p.grammage) * 100) / 100;
        // const coutRevient       = piecesParKgFarine > 0 ? Math.round((coutMP / piecesParKgFarine) * 100) / 100 : 0;
        // const margeValeur       = Math.round((p.prixVente - coutRevient) * 100) / 100;
        // const margePct          = p.prixVente > 0 ? Math.round((margeValeur / p.prixVente) * 10000) / 100 : 0;
        const coutRevient = piecesParKgFarine > 0 ? ((coutMP / piecesParKgFarine) * 100) / 100 : 0;
        const margeValeur = ((p.prixVente - coutRevient) * 100) / 100;
        const margePct = p.prixVente > 0 ? ((margeValeur / p.prixVente) * 10000) / 100 : 0;
        // Prix conseille pour atteindre la marge minimale
        const margeMin = p.margeMin ?? 25;
        const prixConseille = margePct < margeMin && coutRevient > 0
            ? Math.ceil(coutRevient / (1 - margeMin / 100))
            : null;
        return {
            ...p,
            calc: { piecesParKgFarine, coutRevient, margeValeur, margePct, prixConseille },
        };
    });
    return {
        ...recette,
        coutMP,
        coutParKgPate,
        produits: produitsAvecCalc,
    };
}
// ─── Lister les recettes ──────────────────────────────────────────────────────
async function getRecettes(companyId) {
    const recettes = await database_1.default.recette.findMany({
        where: { companyId, actif: true },
        include: includeComplet,
        orderBy: { nom: "asc" },
    });
    // Enrichir en parallele (evite N+1 sequentiel)
    return Promise.all(recettes.map(enrichir));
}
// ─── Créer une recette ────────────────────────────────────────────────────────
async function createRecette(companyId, data) {
    // ── Validation métier ─────────────────────────────────────────────────────
    // 1. Nom déjà utilisé
    const existing = await database_1.default.recette.findFirst({
        where: { nom: data.nom.trim(), companyId, actif: true },
    });
    if (existing)
        throw new error_middleware_1.AppError(`Une recette nommée "${data.nom}" existe déjà. Choisissez un autre nom ou modifiez la recette existante.`, 409);
    // 2. Coefficient invalide
    if (!data.ratioPate || data.ratioPate <= 0)
        throw new error_middleware_1.AppError("Le coefficient (ratio pâte) est obligatoire et doit être supérieur à 0. Exemple : 1.63 pour le Pain Blanc.", 400);
    // 3. Filtrer les lignes vides
    const ingredientsBruts = data.ingredients.filter(ing => ing.mpId && ing.mpId.trim() !== "" && ing.quantite > 0);
    // 4. Aucun ingrédient valide
    if (!ingredientsBruts.length)
        throw new error_middleware_1.AppError("La recette doit avoir au moins un ingrédient. Sélectionnez une matière première et saisissez sa quantité.", 400);
    // 5. Valider chaque MP et quantité
    for (let i = 0; i < ingredientsBruts.length; i++) {
        const ing = ingredientsBruts[i];
        if (ing.quantite <= 0)
            throw new error_middleware_1.AppError(`Ingrédient ligne ${i + 1} : la quantité doit être supérieure à 0.`, 400);
        const mp = await database_1.default.matierePremiere.findFirst({
            where: { id: ing.mpId, companyId },
        });
        if (!mp)
            throw new error_middleware_1.AppError(`Ingrédient ligne ${i + 1} : la matière première sélectionnée n'existe pas ou n'appartient pas à votre établissement.`, 400);
        if (!mp.actif)
            throw new error_middleware_1.AppError(`Ingrédient ligne ${i + 1} : la matière première "${mp.nom}" est désactivée. Réactivez-la d'abord dans Stocks.`, 400);
        if (ing.uniteId?.trim()) {
            const unite = await database_1.default.unite.findFirst({
                where: { id: ing.uniteId, companyId },
            });
            if (!unite)
                throw new error_middleware_1.AppError(`Ingrédient ligne ${i + 1} : l'unité sélectionnée n'existe pas. Vérifiez vos unités dans Paramètres.`, 400);
        }
    }
    // 6. Doublons dans les ingrédients
    const mpIds = ingredientsBruts.map(ing => ing.mpId);
    const doublons = mpIds.filter((id, idx) => mpIds.indexOf(id) !== idx);
    if (doublons.length > 0) {
        const mpDoublon = await database_1.default.matierePremiere.findFirst({ where: { id: doublons[0] } });
        throw new error_middleware_1.AppError(`La matière première "${mpDoublon?.nom ?? "inconnue"}" apparaît plusieurs fois. Fusionnez les lignes en une seule.`, 400);
    }
    const recette = await database_1.default.recette.create({
        data: {
            nom: data.nom,
            description: data.description,
            ratioPate: data.ratioPate,
            tauxPerte: data.tauxPerte ?? 0,
            categorie: data.categorie,
            companyId,
            ingredients: {
                create: ingredientsBruts.map(ing => ({
                    mpId: ing.mpId,
                    quantite: ing.quantite,
                    ...(ing.uniteId?.trim() ? { uniteId: ing.uniteId } : {}),
                })),
            },
        },
        include: includeComplet,
    });
    return enrichir(recette);
}
// ─── Mettre à jour une recette ────────────────────────────────────────────────
async function updateRecette(recetteId, companyId, data) {
    const recette = await database_1.default.recette.findFirst({ where: { id: recetteId, companyId } });
    if (!recette)
        throw new error_middleware_1.AppError("Recette introuvable", 404);
    // Verifier unicite du nom si changement
    if (data.nom && data.nom !== recette.nom) {
        const existing = await database_1.default.recette.findFirst({
            where: { nom: data.nom, companyId, actif: true, NOT: { id: recetteId } },
        });
        if (existing)
            throw new error_middleware_1.AppError(`Une recette "${data.nom}" existe déjà`, 409);
    }
    if (data.ingredients) {
        const ingredientsValides = data.ingredients.filter(ing => ing.mpId && ing.mpId.trim() !== "" && ing.quantite > 0);
        // Supprimer + recréer les ingrédients dans une transaction
        await database_1.default.$transaction([
            database_1.default.recetteIngredient.deleteMany({ where: { recetteId } }),
            database_1.default.recette.update({
                where: { id: recetteId },
                data: {
                    ...(data.nom !== undefined ? { nom: data.nom } : {}),
                    ...(data.ratioPate !== undefined ? { ratioPate: data.ratioPate } : {}),
                    ...(data.tauxPerte !== undefined ? { tauxPerte: data.tauxPerte } : {}),
                    ...(data.categorie !== undefined ? { categorie: data.categorie } : {}),
                    ...(data.description !== undefined ? { description: data.description } : {}),
                    ingredients: {
                        create: ingredientsValides.map(ing => ({
                            mpId: ing.mpId,
                            quantite: ing.quantite,
                            ...(ing.uniteId?.trim() ? { uniteId: ing.uniteId } : {}),
                        })),
                    },
                },
            }),
        ]);
    }
    else {
        await database_1.default.recette.update({
            where: { id: recetteId },
            data: {
                ...(data.nom !== undefined ? { nom: data.nom } : {}),
                ...(data.ratioPate !== undefined ? { ratioPate: data.ratioPate } : {}),
                ...(data.tauxPerte !== undefined ? { tauxPerte: data.tauxPerte } : {}),
                ...(data.categorie !== undefined ? { categorie: data.categorie } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
            },
        });
    }
    const updated = await database_1.default.recette.findUnique({
        where: { id: recetteId },
        include: includeComplet,
    });
    return enrichir(updated);
}
// ─── Dupliquer une recette ────────────────────────────────────────────────────
async function dupliquerRecette(recetteId, companyId) {
    const source = await database_1.default.recette.findFirst({
        where: { id: recetteId, companyId },
        include: { ingredients: true },
    });
    if (!source)
        throw new error_middleware_1.AppError("Recette source introuvable", 404);
    // Trouver un nom unique
    let nom = `${source.nom} (copie)`;
    let tentative = 1;
    while (await database_1.default.recette.findFirst({ where: { nom, companyId, actif: true } })) {
        tentative++;
        nom = `${source.nom} (copie ${tentative})`;
    }
    const copie = await database_1.default.recette.create({
        data: {
            nom,
            description: source.description,
            ratioPate: source.ratioPate,
            tauxPerte: source.tauxPerte ?? 0,
            categorie: source.categorie,
            companyId,
            ingredients: {
                create: source.ingredients.map(ing => ({
                    mpId: ing.mpId,
                    quantite: ing.quantite,
                    ...(ing.uniteId ? { uniteId: ing.uniteId } : {}),
                })),
            },
        },
        include: includeComplet,
    });
    return enrichir(copie);
}
// ─── Archiver une recette (soft delete) ──────────────────────────────────────
async function archiverRecette(recetteId, companyId) {
    const recette = await database_1.default.recette.findFirst({ where: { id: recetteId, companyId } });
    if (!recette)
        throw new error_middleware_1.AppError("Recette introuvable", 404);
    // Verifier qu'elle n'est pas utilisee dans une production recente (30 jours)
    const productionRecente = await database_1.default.production.findFirst({
        where: {
            recetteId,
            date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
    });
    if (productionRecente) {
        throw new error_middleware_1.AppError("Cette recette a été utilisée dans une production récente (30 jours). Archivage impossible.", 409);
    }
    return database_1.default.recette.update({
        where: { id: recetteId },
        data: { actif: false },
    });
}
//# sourceMappingURL=recettes.service.js.map