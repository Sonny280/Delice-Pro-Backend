"use strict";
// ═══════════════════════════════════════════════════════════════
// src/modules/matieresPremières/mp.service.ts
// Logique métier pour les matières premières
// ═══════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.entreeStockSchema = exports.updateMPSchema = exports.createMPSchema = void 0;
exports.getMPList = getMPList;
exports.createMP = createMP;
exports.updateMP = updateMP;
exports.entreeStock = entreeStock;
exports.deleteMP = deleteMP;
exports.getMouvementsStock = getMouvementsStock;
const zod_1 = require("zod");
const database_1 = __importDefault(require("../../config/database"));
const error_middleware_1 = require("../../middleware/error.middleware");
// ─── Schémas de validation ────────────────────────────────────
exports.createMPSchema = zod_1.z.object({
    nom: zod_1.z.string().min(2, "Nom requis"),
    prixAchat: zod_1.z.number().positive("Le prix doit être positif"),
    stockActuel: zod_1.z.number().min(0).default(0),
    seuilAlerte: zod_1.z.number().min(0, "Le seuil doit être positif ou zéro"),
    categorieId: zod_1.z.string().optional(),
    uniteId: zod_1.z.string().optional(),
    fournisseurId: zod_1.z.string().optional(),
});
exports.updateMPSchema = exports.createMPSchema.partial(); // Tous les champs optionnels pour la mise à jour
exports.entreeStockSchema = zod_1.z.object({
    mpId: zod_1.z.string(),
    quantite: zod_1.z.number().positive("La quantité doit être positive"),
    motif: zod_1.z.string().optional(),
});
// ─── Lister toutes les MP d'une entreprise ──────────────────────
async function getMPList(companyId) {
    const mps = await database_1.default.matierePremiere.findMany({
        where: {
            companyId,
            actif: true, // Ne pas afficher les MP désactivées
        },
        include: {
            categorie: { select: { id: true, nom: true } },
            unite: { select: { id: true, nom: true, abreviation: true } },
            fournisseur: { select: { id: true, nom: true } },
        },
        orderBy: { nom: "asc" }, // Trier par nom alphabétique
    });
    // Ajouter une indication de statut pour chaque MP
    return mps.map((mp) => ({
        ...mp,
        // Statut calculé à partir du stock et du seuil
        statut: mp.stockActuel === 0
            ? "RUPTURE"
            : mp.stockActuel <= mp.seuilAlerte
                ? "CRITIQUE"
                : mp.stockActuel <= mp.seuilAlerte * 1.5
                    ? "BAS"
                    : "OK",
    }));
}
// ─── Créer une nouvelle MP ──────────────────────────────────────
async function createMP(companyId, data) {
    // Vérifier qu'une MP avec le même nom n'existe pas déjà pour cette entreprise
    const existing = await database_1.default.matierePremiere.findFirst({
        where: { nom: data.nom, companyId, actif: true },
    });
    if (existing) {
        throw new error_middleware_1.AppError(`Une matière première "${data.nom}" existe déjà`, 409);
    }
    const mp = await database_1.default.matierePremiere.create({
        data: {
            ...data,
            companyId,
        },
        include: {
            categorie: true,
            unite: true,
            fournisseur: true,
        },
    });
    // Si un stock initial est fourni, créer un mouvement d'entrée
    if (data.stockActuel > 0) {
        await database_1.default.mouvementStock.create({
            data: {
                mpId: mp.id,
                type: "ENTREE_ACHAT",
                quantite: data.stockActuel,
                motif: "Stock initial à la création",
            },
        });
    }
    return mp;
}
// ─── Mettre à jour une MP ───────────────────────────────────────
async function updateMP(mpId, companyId, data) {
    // Vérifier que la MP appartient bien à cette entreprise
    const mp = await database_1.default.matierePremiere.findFirst({
        where: { id: mpId, companyId },
    });
    if (!mp) {
        throw new error_middleware_1.AppError("Matière première introuvable", 404);
    }
    return database_1.default.matierePremiere.update({
        where: { id: mpId },
        data,
        include: { categorie: true, unite: true, fournisseur: true },
    });
}
// ─── Entrée de stock (livraison fournisseur) ────────────────────
async function entreeStock(companyId, data) {
    // Vérifier que la MP appartient à cette entreprise
    const mp = await database_1.default.matierePremiere.findFirst({
        where: { id: data.mpId, companyId },
    });
    if (!mp) {
        throw new error_middleware_1.AppError("Matière première introuvable", 404);
    }
    // Utiliser une transaction : mise à jour stock + création mouvement
    const result = await database_1.default.$transaction([
        // Incrémenter le stock
        database_1.default.matierePremiere.update({
            where: { id: data.mpId },
            data: { stockActuel: { increment: data.quantite } },
        }),
        // Créer le mouvement de stock pour la traçabilité
        database_1.default.mouvementStock.create({
            data: {
                mpId: data.mpId,
                type: "ENTREE_ACHAT",
                quantite: data.quantite,
                motif: data.motif ?? "Livraison fournisseur",
            },
        }),
    ]);
    return result[0]; // Retourner la MP mise à jour
}
// ─── Supprimer une MP (soft delete) ────────────────────────────
// On ne supprime jamais vraiment en BDD (besoin de l'historique).
// On désactive juste la MP avec actif = false.
async function deleteMP(mpId, companyId) {
    const mp = await database_1.default.matierePremiere.findFirst({
        where: { id: mpId, companyId },
    });
    if (!mp)
        throw new error_middleware_1.AppError("Matière première introuvable", 404);
    return database_1.default.matierePremiere.update({
        where: { id: mpId },
        data: { actif: false },
    });
}
// ─── Historique des mouvements d'une MP ─────────────────────────
async function getMouvementsStock(mpId, companyId) {
    // Vérifier l'appartenance
    const mp = await database_1.default.matierePremiere.findFirst({
        where: { id: mpId, companyId },
    });
    if (!mp)
        throw new error_middleware_1.AppError("Matière première introuvable", 404);
    return database_1.default.mouvementStock.findMany({
        where: { mpId },
        orderBy: { createdAt: "desc" }, // Plus récent en premier
        take: 50, // Limiter à 50 mouvements
    });
}
//# sourceMappingURL=mp.service.js.map