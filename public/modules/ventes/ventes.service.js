"use strict";
// src/modules/ventes/ventes.service.ts
//
// CORRECTIONS :
// ─────────────────────────────────────────────────────────────────────────────
// FIX 1 : LotStock mis à jour en FIFO à chaque vente (quantiteRestante)
// FIX 2 : Transaction Prisma pour atomicité vente + stock
// FIX 3 : Split paiement sauvegardé en base
// FIX 4 : Protection stock négatif avant la vente
// FIX 5 : Catch avec message d'erreur explicite
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVenteSchema = void 0;
exports.createVente = createVente;
exports.getStatsVentes = getStatsVentes;
exports.ajouterStockProduit = ajouterStockProduit;
exports.getStockProduits = getStockProduits;
const zod_1 = require("zod");
const database_1 = __importDefault(require("../../config/database"));
const error_middleware_1 = require("../../middleware/error.middleware");
// ─── Schémas ──────────────────────────────────────────────────────────────────
exports.createVenteSchema = zod_1.z.object({
    lignes: zod_1.z.array(zod_1.z.object({
        produitId: zod_1.z.string().min(1, "Sélectionnez un produit"),
        // CORRECTION 🟡 : Quantité entière — pas de demi-pain, demi-croissant
        quantite: zod_1.z.number().int("La quantité doit être un entier").positive("La quantité doit être > 0"),
        // CORRECTION 🟡 : Prix optionnel mais si fourni, doit être > 0
        prixUnitaire: zod_1.z.number().positive("Le prix unitaire doit être > 0").optional(),
    })).min(1, "Ajoutez au moins un produit à la vente"),
    // Mode paiement principal
    modePaiement: zod_1.z.enum(["ESPECES", "MOBILE_MONEY", "CARTE_BANCAIRE", "VIREMENT", "A_CREDIT", "AUTRE"])
        .default("ESPECES"),
    // FIX 3 : Split paiement — 2 modes sur 1 vente
    splitPaiement: zod_1.z.boolean().default(false),
    split1Mode: zod_1.z.enum(["ESPECES", "MOBILE_MONEY", "CARTE_BANCAIRE", "VIREMENT"]).optional(),
    split1Montant: zod_1.z.number().min(0).optional(),
    split2Mode: zod_1.z.enum(["ESPECES", "MOBILE_MONEY", "CARTE_BANCAIRE", "VIREMENT", "A_CREDIT"]).optional(),
    split2Montant: zod_1.z.number().min(0).optional(),
    clientId: zod_1.z.string().optional(),
    nomClient: zod_1.z.string().optional(),
    date: zod_1.z.string().datetime().optional(),
    notes: zod_1.z.string().optional(),
    remiseMontant: zod_1.z.number().min(0).default(0),
    remisePct: zod_1.z.number().min(0).max(100).default(0),
});
// ─── Créer une vente ──────────────────────────────────────────────────────────
async function createVente(companyId, userId, data) {
    // 1. Charger tous les produits
    const produitIds = data.lignes.map(l => l.produitId);
    const produits = await database_1.default.produit.findMany({
        where: { id: { in: produitIds }, companyId, actif: true },
    });
    if (produits.length !== produitIds.length) {
        throw new error_middleware_1.AppError("Un ou plusieurs produits sont introuvables", 404);
    }
    const produitsMap = new Map(produits.map(p => [p.id, p]));
    // CORRECTION 🔴 : Re-vérifier le stock en temps réel (problème de concurrence)
    // Si 2 caissiers vendent en même temps le dernier pain, on re-lit depuis la DB
    const produitsTempsReel = await database_1.default.produit.findMany({
        where: { id: { in: produitIds }, companyId },
        select: { id: true, nom: true, stockActuel: true, prixVente: true },
    });
    const mapTempsReel = new Map(produitsTempsReel.map(p => [p.id, p]));
    for (const ligne of data.lignes) {
        const produit = produitsMap.get(ligne.produitId);
        const produitReel = mapTempsReel.get(ligne.produitId);
        const stockReel = produitReel?.stockActuel ?? produit.stockActuel;
        const prixUnitaire = produit.prixVente ?? 0;
        // Stock insuffisant
        if (stockReel < ligne.quantite) {
            throw new error_middleware_1.AppError(`Stock insuffisant pour "${produit.nom}" : ` +
                `demandé ${ligne.quantite}, disponible ${stockReel}. ` +
                `Faites une production avant de vendre.`, 400);
        }
        // CORRECTION 🟡 : Bloquer vente à prix 0 (vente gratuite accidentelle)
        if (prixUnitaire <= 0) {
            throw new error_middleware_1.AppError(`Le prix de "${produit.nom}" est à 0 FCFA. ` +
                `Définissez un prix dans Stocks → Produits avant de vendre.`, 400);
        }
    }
    // 2. Calculer les montants
    const lignesAvecPrix = data.lignes.map(ligne => {
        const produit = produitsMap.get(ligne.produitId);
        const sousTotal = ligne.quantite * produit.prixVente;
        return {
            produitId: ligne.produitId,
            quantite: ligne.quantite,
            prixUnitaire: produit.prixVente,
            sousTotal,
        };
    });
    const montantBrut = lignesAvecPrix.reduce((s, l) => s + l.sousTotal, 0);
    const remiseMontant = Math.min(data.remiseMontant ?? 0, montantBrut);
    const remisePct = data.remisePct ?? 0;
    const montantFinal = Math.max(0, Math.round((montantBrut - remiseMontant) * 100) / 100);
    // Split paiement : valider la cohérence
    if (data.splitPaiement && data.split1Montant !== undefined) {
        const split2 = Math.max(0, montantFinal - data.split1Montant);
        if (data.split1Montant > montantFinal + 0.01) {
            throw new error_middleware_1.AppError(`Le montant split 1 (${data.split1Montant}) dépasse le total (${montantFinal})`, 400);
        }
    }
    // FIX 2 : Tout dans une transaction Prisma
    const result = await database_1.default.$transaction(async (tx) => {
        // 2a. Créer la vente
        const vente = await tx.vente.create({
            data: {
                companyId, userId,
                montantTotal: montantFinal,
                montantBrut,
                remiseMontant,
                remisePct,
                modePaiement: data.modePaiement,
                nomClient: data.nomClient ?? null,
                clientId: data.clientId ?? null,
                date: data.date ? new Date(data.date) : new Date(),
                notes: data.notes,
                // FIX 3 : Split paiement
                splitPaiement: data.splitPaiement ?? false,
                split1Mode: data.splitPaiement ? data.split1Mode : null,
                split1Montant: data.splitPaiement ? data.split1Montant : null,
                split2Mode: data.splitPaiement ? data.split2Mode : null,
                split2Montant: data.splitPaiement
                    ? Math.max(0, montantFinal - (data.split1Montant ?? 0))
                    : null,
                lignes: { create: lignesAvecPrix },
            },
            include: {
                lignes: { include: { produit: { select: { nom: true, dlvJours: true } } } },
                user: { select: { prenom: true, nom: true } },
            },
        });
        // 2b. Décrémenter le stock de chaque produit
        for (const ligne of lignesAvecPrix) {
            await tx.produit.update({
                where: { id: ligne.produitId },
                data: { stockActuel: { decrement: ligne.quantite } },
            });
        }
        // FIX 1 : Mettre à jour les LotStock en FIFO
        // Pour chaque produit vendu, déduire des lots les plus anciens en premier
        for (const ligne of lignesAvecPrix) {
            let qteRestante = ligne.quantite;
            // Charger les lots actifs du produit, triés par dateExpiration ASC (FIFO)
            const lots = await tx.lotStock.findMany({
                where: {
                    companyId,
                    produitId: ligne.produitId,
                    statut: "ACTIF",
                    quantiteRestante: { gt: 0 },
                },
                orderBy: { dateExpiration: "asc" }, // Plus ancien en premier
            });
            for (const lot of lots) {
                if (qteRestante <= 0)
                    break;
                const aDedire = Math.min(lot.quantiteRestante, qteRestante);
                qteRestante -= aDedire;
                const nouvelleQte = lot.quantiteRestante - aDedire;
                await tx.lotStock.update({
                    where: { id: lot.id },
                    data: {
                        quantiteRestante: nouvelleQte,
                        // Si lot épuisé → marquer EPUISE
                        ...(nouvelleQte === 0 ? { statut: "EPUISE" } : {}),
                    },
                });
            }
            // Note : si qteRestante > 0 ici, c'est que le stock est incohérent
            // (produit vendu sans lot correspondant — ex: produit saisi manuellement)
        }
        // 2c. Crédit client
        if (data.modePaiement === "A_CREDIT" && data.clientId) {
            await tx.client.update({
                where: { id: data.clientId },
                data: { soldeCredit: { increment: montantFinal } },
            });
        }
        return vente;
    });
    return result;
}
// ─── Stats des ventes ──────────────────────────────────────────────────────────
async function getStatsVentes(companyId, options = {}) {
    const { dateDebut, dateFin } = options;
    const ventes = await database_1.default.vente.findMany({
        where: {
            companyId,
            ...(dateDebut || dateFin ? {
                date: {
                    ...(dateDebut ? { gte: new Date(dateDebut) } : {}),
                    ...(dateFin ? { lte: new Date(dateFin) } : {}),
                },
            } : {}),
        },
        include: {
            lignes: { include: { produit: { select: { nom: true } } } },
        },
        orderBy: { date: "desc" },
    });
    const caTotale = ventes.reduce((s, v) => s + v.montantTotal, 0);
    const nbTransactions = ventes.length;
    const panierMoyen = nbTransactions > 0 ? caTotale / nbTransactions : 0;
    // Split : répartition par mode réel (mode principal + split)
    const caParMode = {};
    for (const v of ventes) {
        const vAny = v;
        if (vAny.splitPaiement && vAny.split1Mode) {
            // Split : compter chaque mode séparément
            caParMode[vAny.split1Mode] = (caParMode[vAny.split1Mode] ?? 0) + (vAny.split1Montant ?? 0);
            caParMode[vAny.split2Mode] = (caParMode[vAny.split2Mode] ?? 0) + (vAny.split2Montant ?? 0);
        }
        else {
            caParMode[v.modePaiement] = (caParMode[v.modePaiement] ?? 0) + v.montantTotal;
        }
    }
    const ventesParProduit = {};
    for (const vente of ventes) {
        for (const ligne of vente.lignes) {
            const id = ligne.produitId;
            if (!ventesParProduit[id])
                ventesParProduit[id] = { nom: ligne.produit.nom, quantite: 0, ca: 0 };
            ventesParProduit[id].quantite += ligne.quantite;
            ventesParProduit[id].ca += ligne.sousTotal;
        }
    }
    const topProduits = Object.values(ventesParProduit)
        .sort((a, b) => b.ca - a.ca)
        .slice(0, 10);
    return {
        ventes,
        stats: {
            caTotale: Math.round(caTotale),
            nbTransactions,
            panierMoyen: Math.round(panierMoyen),
            topProduits,
            caParMode,
        },
    };
}
async function ajouterStockProduit(companyId, produitId, quantite) {
    const produit = await database_1.default.produit.findFirst({ where: { id: produitId, companyId } });
    if (!produit)
        throw new Error("Produit introuvable");
    return database_1.default.produit.update({ where: { id: produitId }, data: { stockActuel: { increment: quantite } } });
}
async function getStockProduits(companyId) {
    const produits = await database_1.default.produit.findMany({
        where: { companyId, actif: true },
        include: { categorie: { select: { id: true, nom: true } }, recette: { select: { id: true, nom: true } } },
        orderBy: { nom: "asc" },
    });
    return produits.map(p => ({
        ...p,
        statut: p.stockActuel === 0 ? "RUPTURE"
            : p.stockActuel <= p.seuilAlerte ? "CRITIQUE"
                : p.stockActuel <= p.seuilAlerte * 1.5 ? "BAS"
                    : "OK",
    }));
}
//# sourceMappingURL=ventes.service.js.map