"use strict";
// src/modules/pertes/pertes.service.ts
// Ameliorations :
// - Filtres par periode, par type, par cause
// - Stats enrichies : top causes, evolution, valeur journaliere
// - stockGere respecte pour les MP
// - Seuil d'alerte mensuel
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAUSES_MATIERE_PREMIERE = exports.CAUSES_PRODUIT_FINI = exports.createPerteMPSchema = exports.createPerteProduitSchema = void 0;
exports.createPerteProduit = createPerteProduit;
exports.createPerteMP = createPerteMP;
exports.getPertes = getPertes;
const zod_1 = require("zod");
const database_1 = __importDefault(require("../../config/database"));
const error_middleware_1 = require("../../middleware/error.middleware");
const calculations_1 = require("../../utils/calculations");
// ─── Schemas ─────────────────────────────────────────────────────────────────
exports.createPerteProduitSchema = zod_1.z.object({
    produitId: zod_1.z.string({ required_error: "Le produit est requis" }),
    quantite: zod_1.z.number().positive("La quantite doit etre positive"),
    cause: zod_1.z.string().min(1, "La cause est requise"),
    date: zod_1.z.string().datetime().optional(),
    notes: zod_1.z.string().optional(),
    deductMP: zod_1.z.boolean().default(true),
});
exports.createPerteMPSchema = zod_1.z.object({
    mpId: zod_1.z.string({ required_error: "La matiere premiere est requise" }),
    quantite: zod_1.z.number().positive("La quantite doit etre positive"),
    cause: zod_1.z.string().min(1, "La cause est requise"),
    date: zod_1.z.string().datetime().optional(),
    notes: zod_1.z.string().optional(),
});
// ─── Causes prédéfinies ───────────────────────────────────────────────────────
exports.CAUSES_PRODUIT_FINI = [
    "Invendu fin de journee",
    "Produit abime / casse",
    "Produit perime",
    "Erreur de commande client",
    "Chute / accident",
    "Defaut de fabrication",
    "Autre",
];
exports.CAUSES_MATIERE_PREMIERE = [
    "Mauvais dosage corrige en production",
    "Deversement accidentel",
    "MP perimee en stock",
    "Contamination",
    "Erreur de preparation",
    "Pate jetee apres production",
    "Autre",
];
// ─── Enregistrer une perte produit fini ──────────────────────────────────────
async function createPerteProduit(companyId, data) {
    const produit = await database_1.default.produit.findFirst({
        where: { id: data.produitId, companyId, actif: true },
        include: {
            recette: { include: { ingredients: { include: { mp: true, unite: true } } } },
        },
    });
    if (!produit)
        throw new error_middleware_1.AppError("Produit introuvable", 404);
    const valeur = Math.round(data.quantite * produit.prixVente * 100) / 100;
    const perte = await database_1.default.perte.create({
        data: {
            companyId,
            type: "PRODUIT_FINI",
            produitId: data.produitId,
            quantite: data.quantite,
            valeur,
            cause: data.cause,
            deductMP: data.deductMP,
            date: data.date ? new Date(data.date) : new Date(),
            notes: data.notes,
        },
        include: { produit: { select: { nom: true, prixVente: true } } },
    });
    // Deduire les MP du stock si demande
    let impactsMP = [];
    if (data.deductMP) {
        impactsMP = await (0, calculations_1.calculerImpactMPProduitPerdu)(data.produitId, data.quantite);
        for (const impact of impactsMP) {
            // Verifier que la MP a son stock gere
            const mp = await database_1.default.matierePremiere.findUnique({ where: { id: impact.mpId } });
            if (!mp || mp.stockGere === false)
                continue;
            await (0, calculations_1.deduireStockMP)(impact.mpId, impact.quantiteADeduire, "SORTIE_PERTE_PRODUIT", `Perte produit : ${produit.nom} x${data.quantite} (${data.cause})`);
        }
    }
    return {
        perte,
        valeur,
        impactsMP,
        message: data.deductMP
            ? `Perte enregistree. ${impactsMP.length} matiere(s) premiere(s) deduites du stock.`
            : "Perte enregistree. Aucune deduction de stock MP.",
    };
}
// ─── Enregistrer une perte MP ─────────────────────────────────────────────────
async function createPerteMP(companyId, data) {
    const mp = await database_1.default.matierePremiere.findFirst({
        where: { id: data.mpId, companyId, actif: true },
        include: { unite: true },
    });
    if (!mp)
        throw new error_middleware_1.AppError("Matiere premiere introuvable", 404);
    // Valeur = 0 si MP non geree (eau, sel...)
    const nonGeree = mp.stockGere === false;
    const valeur = nonGeree ? 0 : Math.round(data.quantite * mp.prixAchat * 100) / 100;
    const perte = await database_1.default.perte.create({
        data: {
            companyId,
            type: "MATIERE_PREMIERE",
            mpId: data.mpId,
            quantite: data.quantite,
            valeur,
            cause: data.cause,
            deductMP: !nonGeree,
            date: data.date ? new Date(data.date) : new Date(),
            notes: data.notes,
        },
        include: { mp: { select: { nom: true, prixAchat: true } } },
    });
    // Deduire du stock uniquement si gere
    if (!nonGeree) {
        await (0, calculations_1.deduireStockMP)(data.mpId, data.quantite, "SORTIE_PERTE_MP", `Perte MP : ${mp.nom} x${data.quantite} (${data.cause})`);
    }
    return {
        perte,
        valeur,
        message: nonGeree
            ? `Perte enregistree (stock non gere — aucune deduction).`
            : `Perte de ${data.quantite} ${mp.unite?.abreviation ?? ""} de ${mp.nom} enregistree. Stock mis a jour.`,
    };
}
// ─── Lister et analyser les pertes ───────────────────────────────────────────
async function getPertes(companyId, options = {}) {
    const { type, cause, dateDebut, dateFin, limit = 200 } = options;
    const where = {
        companyId,
        ...(type ? { type } : {}),
        ...(cause ? { cause } : {}),
        ...(dateDebut || dateFin ? {
            date: {
                ...(dateDebut ? { gte: new Date(dateDebut) } : {}),
                ...(dateFin ? { lte: new Date(new Date(dateFin).setHours(23, 59, 59)) } : {}),
            },
        } : {}),
    };
    const pertes = await database_1.default.perte.findMany({
        where,
        include: {
            produit: { select: { nom: true, prixVente: true } },
            mp: { select: { nom: true, prixAchat: true } },
        },
        orderBy: { date: "desc" },
        take: limit,
    });
    // Stats globales
    const totalProduits = pertes.filter(p => p.type === "PRODUIT_FINI").reduce((s, p) => s + p.valeur, 0);
    const totalMP = pertes.filter(p => p.type === "MATIERE_PREMIERE").reduce((s, p) => s + p.valeur, 0);
    // Top 5 causes
    const parCause = new Map();
    for (const p of pertes) {
        const ex = parCause.get(p.cause);
        if (ex) {
            ex.count++;
            ex.valeur += p.valeur;
        }
        else
            parCause.set(p.cause, { cause: p.cause, count: 1, valeur: p.valeur });
    }
    const topCauses = Array.from(parCause.values())
        .sort((a, b) => b.valeur - a.valeur)
        .slice(0, 5);
    // Pertes par jour (7 derniers jours)
    const sept = new Date();
    sept.setDate(sept.getDate() - 6);
    const pertesRecentes = await database_1.default.perte.findMany({
        where: { companyId, date: { gte: sept } },
        select: { date: true, valeur: true },
    });
    const parJour = {};
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        parJour[d.toISOString().split("T")[0]] = 0;
    }
    for (const p of pertesRecentes) {
        const key = new Date(p.date).toISOString().split("T")[0];
        if (parJour[key] !== undefined)
            parJour[key] += p.valeur;
    }
    // Stats du mois en cours
    const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const pertesMois = await database_1.default.perte.aggregate({
        where: { companyId, date: { gte: debutMois } },
        _sum: { valeur: true },
        _count: true,
    });
    // Produit le plus souvent perdu
    const parProduit = new Map();
    for (const p of pertes.filter(p => p.type === "PRODUIT_FINI")) {
        const nom = p.produit?.nom ?? "Inconnu";
        const ex = parProduit.get(nom);
        if (ex) {
            ex.count += p.quantite;
            ex.valeur += p.valeur;
        }
        else
            parProduit.set(nom, { nom, count: p.quantite, valeur: p.valeur });
    }
    const topProduitPerdu = Array.from(parProduit.values())
        .sort((a, b) => b.valeur - a.valeur)[0] ?? null;
    return {
        pertes,
        stats: {
            totalValeurProduits: Math.round(totalProduits),
            totalValeurMP: Math.round(totalMP),
            totalValeur: Math.round(totalProduits + totalMP),
            nbPertes: pertes.length,
            topCauses,
            parJour,
            topProduitPerdu,
            mois: {
                valeur: Math.round(pertesMois._sum.valeur ?? 0),
                count: pertesMois._count,
            },
        },
    };
}
//# sourceMappingURL=pertes.service.js.map