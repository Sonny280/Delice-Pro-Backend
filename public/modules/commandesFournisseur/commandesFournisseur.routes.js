"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/commandesFournisseur/commandesFournisseur.routes.ts
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const database_1 = __importDefault(require("../../config/database"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// ─── Helpers ──────────────────────────────────────────────────────────────────
async function genererReference(companyId) {
    const count = await database_1.default.commandeFournisseur.count({ where: { companyId } });
    const year = new Date().getFullYear();
    return `CF-${year}-${String(count + 1).padStart(3, "0")}`;
}
const includeComplet = {
    fournisseur: {
        select: {
            id: true, nom: true, telephone: true, email: true,
            adresse: true, contact: true, conditionsPaiement: true, delaiLivraison: true,
        },
    },
    lignes: {
        include: {
            mp: {
                select: {
                    id: true, nom: true, prixAchat: true, stockActuel: true,
                    seuilAlerte: true, unite: { select: { abreviation: true } },
                },
            },
        },
        orderBy: { id: "asc" },
    },
};
const ligneSchema = zod_1.z.object({
    mpId: zod_1.z.string(),
    quantite: zod_1.z.number().positive(),
    prixUnitaire: zod_1.z.number().positive(),
});
const commandeSchema = zod_1.z.object({
    fournisseurId: zod_1.z.string(),
    dateLivraisonPrevue: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    lignes: zod_1.z.array(ligneSchema).min(1),
});
// ─── GET /utils/suggestions — MP sous le seuil (AVANT /:id) ──────────────────
// IMPORTANT : cette route doit etre declaree AVANT /:id sinon Express
// interprete "utils" comme un ID
router.get("/utils/suggestions", async (req, res) => {
    // Comparaison colonne vs colonne via $queryRaw
    const mpsEnAlerte = await database_1.default.matierePremiere.findMany({
        where: {
            companyId: req.user.companyId,
            actif: true,
            stockGere: true, // Ne pas suggerer les ingredients non geres (eau, sel...)
        },
        include: {
            fournisseur: { select: { id: true, nom: true } },
            unite: { select: { abreviation: true } },
        },
        orderBy: { stockActuel: "asc" },
    });
    // Filtrer en JS : stock <= seuil
    const enAlerte = mpsEnAlerte.filter(m => m.stockActuel <= m.seuilAlerte);
    res.json({ success: true, data: enAlerte });
});
// ─── GET / — Lister toutes les commandes ─────────────────────────────────────
router.get("/", async (req, res) => {
    const { statut, fournisseurId } = req.query;
    const commandes = await database_1.default.commandeFournisseur.findMany({
        where: {
            companyId: req.user.companyId,
            ...(statut ? { statut: statut } : {}),
            ...(fournisseurId ? { fournisseurId: fournisseurId } : {}),
        },
        include: includeComplet,
        orderBy: { dateCommande: "desc" },
    });
    const stats = {
        total: commandes.length,
        enAttente: commandes.filter(c => ["BROUILLON", "ENVOYEE"].includes(c.statut)).length,
        recu: commandes.filter(c => ["RECUE", "RECUE_PARTIELLE"].includes(c.statut)).length,
        annule: commandes.filter(c => c.statut === "ANNULEE").length,
        montantEngage: commandes.filter(c => c.statut === "ENVOYEE").reduce((s, c) => s + c.montantTotal, 0),
        enRetard: commandes.filter(c => c.statut === "ENVOYEE" && c.dateLivraisonPrevue && new Date(c.dateLivraisonPrevue) < new Date()).length,
    };
    res.json({ success: true, data: commandes, stats });
});
// ─── GET /:id — Detail d'une commande ────────────────────────────────────────
router.get("/:id", async (req, res) => {
    const commande = await database_1.default.commandeFournisseur.findFirst({
        where: { id: req.params.id, companyId: req.user.companyId },
        include: includeComplet,
    });
    if (!commande)
        return res.status(404).json({ success: false, message: "Commande introuvable" });
    res.json({ success: true, data: commande });
});
// ─── POST / — Creer une commande ─────────────────────────────────────────────
router.post("/", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]), async (req, res) => {
    const data = commandeSchema.parse(req.body);
    const reference = await genererReference(req.user.companyId);
    const montantTotal = data.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
    const commande = await database_1.default.commandeFournisseur.create({
        data: {
            reference,
            fournisseurId: data.fournisseurId,
            companyId: req.user.companyId,
            userId: req.user.id, // champ simple, pas de relation Prisma
            dateLivraisonPrevue: data.dateLivraisonPrevue ? new Date(data.dateLivraisonPrevue) : null,
            notes: data.notes,
            montantTotal,
            lignes: {
                create: data.lignes.map(l => ({
                    mpId: l.mpId,
                    quantite: l.quantite,
                    prixUnitaire: l.prixUnitaire,
                    sousTotal: l.quantite * l.prixUnitaire,
                })),
            },
        },
        include: includeComplet,
    });
    res.status(201).json({ success: true, data: commande });
});
// ─── PUT /:id — Modifier une commande BROUILLON ──────────────────────────────
router.put("/:id", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]), async (req, res) => {
    // Ignorer la route /:id/statut qui est geree separement
    if (req.params.id === "statut")
        return res.status(400).json({ success: false });
    const commande = await database_1.default.commandeFournisseur.findFirst({
        where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!commande)
        return res.status(404).json({ success: false, message: "Commande introuvable" });
    if (commande.statut !== "BROUILLON") {
        return res.status(400).json({ success: false, message: "Seules les commandes en brouillon peuvent etre modifiees" });
    }
    const data = commandeSchema.parse(req.body);
    const montantTotal = data.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
    await database_1.default.ligneCommandeFournisseur.deleteMany({ where: { commandeId: req.params.id } });
    const updated = await database_1.default.commandeFournisseur.update({
        where: { id: req.params.id },
        data: {
            fournisseurId: data.fournisseurId,
            dateLivraisonPrevue: data.dateLivraisonPrevue ? new Date(data.dateLivraisonPrevue) : null,
            notes: data.notes,
            montantTotal,
            lignes: {
                create: data.lignes.map(l => ({
                    mpId: l.mpId,
                    quantite: l.quantite,
                    prixUnitaire: l.prixUnitaire,
                    sousTotal: l.quantite * l.prixUnitaire,
                })),
            },
        },
        include: includeComplet,
    });
    res.json({ success: true, data: updated });
});
// ─── PUT /:id/statut — Changer le statut ─────────────────────────────────────
router.put("/:id/statut", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]), async (req, res) => {
    const { statut, quantitesRecues } = zod_1.z.object({
        statut: zod_1.z.enum(["BROUILLON", "ENVOYEE", "RECUE_PARTIELLE", "RECUE", "ANNULEE"]),
        quantitesRecues: zod_1.z.array(zod_1.z.object({
            ligneId: zod_1.z.string(),
            quantiteRecue: zod_1.z.number().min(0),
        })).optional(),
    }).parse(req.body);
    // CORRECTION 🔴 : Empêcher double réception
    const commandeActuelle = await database_1.default.commandeFournisseur.findUnique({
        where: { id: req.params.id }, select: { statut: true, reference: true },
    });
    if (commandeActuelle?.statut === "RECUE" && statut === "RECUE") {
        res.status(400).json({
            success: false,
            message: `Commande ${commandeActuelle.reference} déjà réceptionnée — stock déjà mis à jour.`,
        });
        return;
    }
    // Reception : mise a jour stocks MP
    if (["RECUE", "RECUE_PARTIELLE"].includes(statut) && quantitesRecues) {
        for (const { ligneId, quantiteRecue } of quantitesRecues) {
            if (quantiteRecue <= 0)
                continue;
            const ligne = await database_1.default.ligneCommandeFournisseur.findUnique({
                where: { id: ligneId },
                include: { mp: true, commande: true },
            });
            if (!ligne)
                continue;
            await database_1.default.ligneCommandeFournisseur.update({
                where: { id: ligneId },
                data: { quantiteRecue },
            });
            await database_1.default.matierePremiere.update({
                where: { id: ligne.mpId },
                data: {
                    stockActuel: { increment: quantiteRecue },
                    // Mettre a jour le prix d'achat si le prix de commande est different
                    ...(ligne.prixUnitaire !== ligne.mp.prixAchat
                        ? { prixAchat: ligne.prixUnitaire }
                        : {}),
                },
            });
            await database_1.default.mouvementStock.create({
                data: {
                    mpId: ligne.mpId,
                    type: "ENTREE_ACHAT",
                    quantite: quantiteRecue,
                    motif: `Reception ${ligne.commande.reference}`,
                },
            });
        }
    }
    const commande = await database_1.default.commandeFournisseur.update({
        where: { id: req.params.id },
        data: {
            statut,
            ...(["RECUE", "RECUE_PARTIELLE"].includes(statut) ? { dateLivraisonReelle: new Date() } : {}),
        },
        include: includeComplet,
    });
    res.json({ success: true, data: commande });
});
exports.default = router;
//# sourceMappingURL=commandesFournisseur.routes.js.map