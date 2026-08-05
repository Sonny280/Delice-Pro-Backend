"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/commandesClient/commandesClient.routes.ts
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const database_1 = __importDefault(require("../../config/database"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// Génère une référence unique ex: CMD-2025-042
async function genererReference(companyId) {
    const count = await database_1.default.commandeClient.count({ where: { companyId } });
    const year = new Date().getFullYear();
    return `CMD-${year}-${String(count + 1).padStart(3, "0")}`;
}
const ligneSchema = zod_1.z.object({
    produitId: zod_1.z.string(),
    quantite: zod_1.z.number().int().positive(),
    prixUnitaire: zod_1.z.number().positive(),
});
const commandeSchema = zod_1.z.object({
    clientId: zod_1.z.string(),
    dateLivraison: zod_1.z.string(),
    // AJOUT : mode de paiement et acompte
    modePaiement: zod_1.z.enum(["ESPECES", "MOBILE_MONEY", "CHEQUE", "VIREMENT", "A_CREDIT"]).default("ESPECES"),
    acompte: zod_1.z.number().min(0).default(0),
    notes: zod_1.z.string().optional(),
    lignes: zod_1.z.array(ligneSchema).min(1),
});
// GET /api/commandes-client
router.get("/", async (req, res) => {
    const { statut } = req.query;
    const commandes = await database_1.default.commandeClient.findMany({
        where: {
            companyId: req.user.companyId,
            ...(statut ? { statut: statut } : {}),
        },
        include: {
            client: { select: { id: true, nom: true, telephone: true, type: true } },
            lignes: {
                include: { produit: { select: { id: true, nom: true, prixVente: true, stockActuel: true, seuilAlerte: true } } },
            },
        },
        orderBy: { dateLivraison: "asc" },
    });
    res.json({ success: true, data: commandes });
});
// POST /api/commandes-client
router.post("/", async (req, res) => {
    const data = commandeSchema.parse(req.body);
    const reference = await genererReference(req.user.companyId);
    const montantTotal = data.lignes.reduce((sum, l) => sum + l.quantite * l.prixUnitaire, 0);
    const companyId = req.user.companyId;
    const userId = req.user.id;
    // CORRECTION 🟠 : Acompte ne peut pas dépasser le montant total
    if (data.acompte > montantTotal) {
        res.status(400).json({
            success: false,
            message: `L'acompte (${data.acompte.toLocaleString("fr-FR")} FCFA) ne peut pas dépasser ` +
                `le montant total de la commande (${montantTotal.toLocaleString("fr-FR")} FCFA).`,
        });
        return;
    }
    // AJOUT : Vérifier le stock pour chaque produit AVANT de créer la commande
    // Si tout le stock est disponible → PRETE directement
    // Sinon → EN_PRODUCTION (le boulanger doit produire)
    const produitsStock = await database_1.default.produit.findMany({
        where: { id: { in: data.lignes.map(l => l.produitId) }, companyId },
        select: { id: true, nom: true, stockActuel: true },
    });
    const mapStock = new Map(produitsStock.map(p => [p.id, p]));
    // Vérifier chaque ligne
    const manquants = [];
    for (const ligne of data.lignes) {
        const produit = mapStock.get(ligne.produitId);
        const stock = produit?.stockActuel ?? 0;
        if (stock < ligne.quantite) {
            manquants.push({
                nom: produit?.nom ?? ligne.produitId,
                commandé: ligne.quantite,
                disponible: stock,
                aProduire: ligne.quantite - stock,
            });
        }
    }
    // Statut automatique selon disponibilité
    const statutAuto = manquants.length === 0 ? "PRETE" : "EN_PRODUCTION";
    const messageAuto = manquants.length === 0
        ? "Stock disponible — commande prête à livrer"
        : `Stock insuffisant pour ${manquants.length} produit(s) — production nécessaire`;
    const commande = await database_1.default.$transaction(async (tx) => {
        // Créer la commande avec statut automatique
        const cmd = await database_1.default.commandeClient.create({
            data: {
                reference,
                clientId: data.clientId,
                companyId,
                dateLivraison: new Date(data.dateLivraison),
                acompte: data.acompte,
                montantTotal,
                statut: statutAuto,
                notes: data.notes,
                lignes: {
                    create: data.lignes.map(l => ({
                        produitId: l.produitId,
                        quantite: l.quantite,
                        prixUnitaire: l.prixUnitaire,
                        sousTotal: l.quantite * l.prixUnitaire,
                    })),
                },
            },
            include: {
                client: true,
                lignes: { include: { produit: { select: { id: true, nom: true, prixVente: true, stockActuel: true, seuilAlerte: true } } } },
            },
        });
        // AJOUT : Encaisser l'acompte immédiatement si > 0 et pas à crédit
        if (data.acompte > 0 && data.modePaiement !== "A_CREDIT") {
            const nbVentes = await tx.vente.count({ where: { companyId } });
            await tx.vente.create({
                data: {
                    companyId,
                    userId,
                    numeroTicket: `ACP-${String(nbVentes + 1).padStart(5, "0")}`,
                    montantTotal: data.acompte,
                    montantBrut: data.acompte,
                    modePaiement: data.modePaiement,
                    clientId: data.clientId,
                    statut: "VALIDEE",
                    notes: `Acompte commande ${reference}`,
                },
            });
        }
        return cmd;
    });
    // Retourner la commande avec infos de stock
    res.status(201).json({
        success: true,
        data: commande,
        // AJOUT : Infos stock pour affichage immédiat
        statutAuto,
        messageAuto,
        manquants, // Produits à produire
        stockOK: manquants.length === 0,
    });
});
// PUT /api/commandes-client/:id/statut — Changer le statut
router.put("/:id/statut", async (req, res) => {
    try {
        // MODIFICATION : Accepter aussi le mode de paiement à la livraison
        const { statut, modePaiementLivraison } = zod_1.z.object({
            statut: zod_1.z.enum(["RECUE", "EN_PRODUCTION", "PRETE", "LIVREE", "ANNULEE"]),
            modePaiementLivraison: zod_1.z.enum(["ESPECES", "MOBILE_MONEY", "CHEQUE", "VIREMENT", "A_CREDIT"]).optional(),
        }).parse(req.body);
        // Vérifier statut actuel pour éviter double décrément
        const actuelle = await database_1.default.commandeClient.findUnique({
            where: { id: req.params.id },
            include: { lignes: true },
        });
        if (!actuelle) {
            res.status(404).json({ success: false, message: "Commande introuvable" });
            return;
        }
        // ── LIVRAISON : décrément stock + création vente ─────────────────────────────
        if (statut === "LIVREE" && actuelle.statut !== "LIVREE") {
            const companyId = req.user.companyId;
            const userId = req.user.id;
            // FIX 1 : Vérifier stock suffisant avant tout
            const produits = await database_1.default.produit.findMany({
                where: { id: { in: actuelle.lignes.map(l => l.produitId) } },
            });
            const produitsMap = new Map(produits.map(p => [p.id, p]));
            for (const ligne of actuelle.lignes) {
                const prod = produitsMap.get(ligne.produitId);
                if (prod && prod.stockActuel < ligne.quantite) {
                    res.status(400).json({
                        success: false,
                        message: `Stock insuffisant pour "${prod.nom}" : ` +
                            `demandé ${ligne.quantite}, disponible ${prod.stockActuel}. ` +
                            `Faites d'abord une production.`,
                    });
                    return;
                }
            }
            await database_1.default.$transaction(async (tx) => {
                // Décrémenter stock produits
                for (const ligne of actuelle.lignes) {
                    await tx.produit.update({
                        where: { id: ligne.produitId },
                        data: { stockActuel: { decrement: ligne.quantite } },
                    });
                    // FIFO lots
                    let qteRestante = ligne.quantite;
                    const lots = await tx.lotStock.findMany({
                        where: { produitId: ligne.produitId, statut: "ACTIF", quantiteRestante: { gt: 0 } },
                        orderBy: { dateExpiration: "asc" },
                    });
                    for (const lot of lots) {
                        if (qteRestante <= 0)
                            break;
                        const aDeduire = Math.min(qteRestante, lot.quantiteRestante);
                        const nouvelleQte = lot.quantiteRestante - aDeduire;
                        await tx.lotStock.update({
                            where: { id: lot.id },
                            data: { quantiteRestante: nouvelleQte, statut: nouvelleQte <= 0 ? "EPUISE" : "ACTIF" },
                        });
                        qteRestante -= aDeduire;
                    }
                }
                // MODIFICATION : Créer une vente pour le SOLDE restant (montant - acompte)
                // L'acompte a déjà été encaissé à la création de la commande
                const montantTotal = actuelle.montantTotal ?? actuelle.lignes.reduce((s, l) => s + l.montantLigne, 0);
                const acompteDejaEnc = actuelle.acompte ?? 0;
                const solde = montantTotal - acompteDejaEnc;
                // CORRECTION : utiliser modePaiementLivraison du body uniquement (pas de colonne DB encore)
                // CORRECTION 🟠 : Mode de paiement obligatoire si solde > 0
                const modePaie = (req.body.modePaiementLivraison ?? "ESPECES");
                if (solde > 0 && !req.body.modePaiementLivraison) {
                    // Défaut à ESPECES si non fourni (déjà géré ci-dessus)
                    console.warn("[LIVRAISON] Mode paiement non spécifié — défaut ESPECES");
                }
                const nbVentes = await tx.vente.count({ where: { companyId } });
                // N'encaisser que si solde > 0 et pas à crédit
                if (solde > 0 && modePaie !== "A_CREDIT") {
                    await tx.vente.create({
                        data: {
                            companyId,
                            userId,
                            montantTotal: solde,
                            montantBrut: solde,
                            modePaiement: modePaie,
                            clientId: actuelle.clientId,
                            statut: "VALIDEE",
                            notes: `Solde livraison ${actuelle.reference ?? actuelle.id}`,
                        },
                    });
                }
                // Statut commande → LIVREE
                await tx.commandeClient.update({
                    where: { id: req.params.id },
                    data: { statut, dateLivraison: new Date() },
                });
            });
            // ── ANNULATION : restituer stock si était LIVREE ──────────────────────────
        }
        else if (statut === "ANNULEE" && actuelle.statut === "LIVREE") {
            await database_1.default.$transaction(async (tx) => {
                for (const ligne of actuelle.lignes) {
                    await tx.produit.update({
                        where: { id: ligne.produitId },
                        data: { stockActuel: { increment: ligne.quantite } },
                    });
                }
                await tx.commandeClient.update({
                    where: { id: req.params.id },
                    data: { statut },
                });
            });
        }
        else {
            // Changement de statut sans impact stock
            await database_1.default.commandeClient.update({
                where: { id: req.params.id },
                data: { statut },
            });
        }
        const commande = await database_1.default.commandeClient.findUnique({
            where: { id: req.params.id },
            include: { client: true, lignes: { include: { produit: true } } },
        });
        res.json({ success: true, data: commande });
    }
    catch (e) {
        console.error("[STATUT ERROR]", e?.message ?? e);
        res.status(500).json({ success: false, message: e?.message ?? "Erreur interne" });
    }
});
// PUT /api/commandes-client/:id — Modifier une commande
router.put("/:id", async (req, res) => {
    const data = commandeSchema.partial().parse(req.body);
    const montantTotal = data.lignes
        ? data.lignes.reduce((sum, l) => sum + l.quantite * l.prixUnitaire, 0)
        : undefined;
    // Si on modifie les lignes, on supprime et recrée
    if (data.lignes) {
        await database_1.default.ligneCommandeClient.deleteMany({ where: { commandeId: req.params.id } });
    }
    const commande = await database_1.default.commandeClient.update({
        where: { id: req.params.id },
        data: {
            ...(data.clientId ? { clientId: data.clientId } : {}),
            ...(data.dateLivraison ? { dateLivraison: new Date(data.dateLivraison) } : {}),
            ...(data.acompte !== undefined ? { acompte: data.acompte } : {}),
            ...(data.notes !== undefined ? { notes: data.notes } : {}),
            ...(montantTotal !== undefined ? { montantTotal } : {}),
            ...(data.lignes ? {
                lignes: {
                    create: data.lignes.map(l => ({
                        produitId: l.produitId,
                        quantite: l.quantite,
                        prixUnitaire: l.prixUnitaire,
                        sousTotal: l.quantite * l.prixUnitaire,
                    })),
                },
            } : {}),
        },
        include: { client: true, lignes: { include: { produit: true } } },
    });
    res.json({ success: true, data: commande });
});
// DELETE /api/commandes-client/:id
router.delete("/:id", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE"]), async (req, res) => {
    await database_1.default.commandeClient.update({
        where: { id: req.params.id },
        data: { statut: "ANNULEE" },
    });
    res.json({ success: true });
});
exports.default = router;
//# sourceMappingURL=commandesClient.routes.js.map