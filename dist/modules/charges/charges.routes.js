"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/charges/charges.routes.ts
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const database_1 = __importDefault(require("../../config/database"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// ── Catégories ────────────────────────────────────────────────
router.get("/categories", async (req, res) => {
    const cats = await database_1.default.categorieCharge.findMany({
        where: { companyId: req.user.companyId, actif: true },
        orderBy: { ordre: "asc" },
        include: { _count: { select: { charges: true } } },
    });
    res.json({ success: true, data: cats });
});
router.post("/categories", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE"]), async (req, res) => {
    const { nom, icone = "📋", couleur = "#6B7280" } = req.body;
    if (!nom)
        return res.status(400).json({ success: false, message: "Nom obligatoire" });
    const companyId = req.user.companyId;
    const last = await database_1.default.categorieCharge.findFirst({ where: { companyId }, orderBy: { ordre: "desc" } });
    const cat = await database_1.default.categorieCharge.create({ data: { nom, icone, couleur, ordre: (last?.ordre ?? 0) + 1, companyId } });
    res.json({ success: true, data: cat });
});
router.put("/categories/:id", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE"]), async (req, res) => {
    const { nom, icone, couleur } = req.body;
    await database_1.default.categorieCharge.updateMany({ where: { id: req.params.id, companyId: req.user.companyId }, data: { nom, icone, couleur } });
    res.json({ success: true });
});
router.delete("/categories/:id", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE"]), async (req, res) => {
    const companyId = req.user.companyId;
    const count = await database_1.default.charge.count({ where: { categorieId: req.params.id, companyId } });
    if (count > 0)
        return res.status(400).json({ success: false, message: `${count} charge(s) liée(s) — supprimez-les d'abord` });
    await database_1.default.categorieCharge.updateMany({ where: { id: req.params.id, companyId }, data: { actif: false } });
    res.json({ success: true });
});
// ── Charges ───────────────────────────────────────────────────
router.get("/", async (req, res) => {
    const { dateDebut, dateFin, categorieId, recurrence } = req.query;
    const companyId = req.user.companyId;
    const where = { companyId };
    if (categorieId)
        where.categorieId = categorieId;
    if (recurrence)
        where.recurrence = recurrence;
    if (dateDebut || dateFin) {
        where.date = {};
        if (dateDebut)
            where.date.gte = new Date(dateDebut);
        if (dateFin)
            where.date.lte = new Date(new Date(dateFin).setHours(23, 59, 59, 999));
    }
    const charges = await database_1.default.charge.findMany({
        where, include: { categorie: { select: { nom: true, icone: true, couleur: true } } },
        orderBy: { date: "desc" },
    });
    const totalCharges = charges.reduce((s, c) => s + c.montant, 0);
    res.json({ success: true, data: { charges, totalCharges } });
});
router.post("/", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]), async (req, res) => {
    const schema = zod_1.z.object({
        libelle: zod_1.z.string().min(1),
        // CORRECTION 🟡 : Montant max pour éviter erreurs de saisie
        montant: zod_1.z.number().positive("Montant doit être positif").max(10000000, "Montant trop élevé"),
        date: zod_1.z.string().default(new Date().toISOString()),
        categorieId: zod_1.z.string(), notes: zod_1.z.string().optional(),
        recurrence: zod_1.z.enum(["PONCTUELLE", "MENSUELLE", "ANNUELLE"]).default("PONCTUELLE"),
    });
    const data = schema.parse(req.body);
    const companyId = req.user.companyId;
    const cat = await database_1.default.categorieCharge.findFirst({ where: { id: data.categorieId, companyId } });
    if (!cat)
        return res.status(404).json({ success: false, message: "Catégorie introuvable" });
    const charge = await database_1.default.charge.create({
        data: { ...data, date: new Date(data.date), companyId },
        include: { categorie: { select: { nom: true, icone: true, couleur: true } } },
    });
    res.json({ success: true, data: charge });
});
router.put("/:id", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]), async (req, res) => {
    const schema = zod_1.z.object({
        libelle: zod_1.z.string().min(1).optional(), montant: zod_1.z.number().positive().optional(),
        date: zod_1.z.string().optional(), categorieId: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
        recurrence: zod_1.z.enum(["PONCTUELLE", "MENSUELLE", "ANNUELLE"]).optional(),
    });
    const data = schema.parse(req.body);
    await database_1.default.charge.updateMany({
        where: { id: req.params.id, companyId: req.user.companyId },
        data: { ...data, ...(data.date ? { date: new Date(data.date) } : {}) },
    });
    res.json({ success: true });
});
router.delete("/:id", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE"]), async (req, res) => {
    await database_1.default.charge.deleteMany({ where: { id: req.params.id, companyId: req.user.companyId } });
    res.json({ success: true });
});
// ── Synthèse financière ───────────────────────────────────────
router.get("/synthese", async (req, res) => {
    const { dateDebut, dateFin } = req.query;
    const companyId = req.user.companyId;
    const debut = dateDebut ? new Date(dateDebut) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const fin = dateFin ? new Date(new Date(dateFin).setHours(23, 59, 59, 999)) : new Date();
    const [ventes, pertesMP, pertesPF, charges] = await Promise.all([
        database_1.default.vente.aggregate({ where: { companyId, date: { gte: debut, lte: fin }, statut: "VALIDEE" }, _sum: { montantTotal: true }, _count: true }),
        database_1.default.perte.aggregate({ where: { companyId, date: { gte: debut, lte: fin }, type: "MATIERE_PREMIERE" }, _sum: { valeur: true } }),
        database_1.default.perte.aggregate({ where: { companyId, date: { gte: debut, lte: fin }, type: "PRODUIT_FINI" }, _sum: { valeur: true } }),
        database_1.default.charge.findMany({ where: { companyId, date: { gte: debut, lte: fin } }, include: { categorie: { select: { nom: true, icone: true, couleur: true } } } }),
    ]);
    const ca = ventes._sum.montantTotal ?? 0;
    const totalPertes = (pertesMP._sum.valeur ?? 0) + (pertesPF._sum.valeur ?? 0);
    const margeBrute = ca - totalPertes;
    const totalCharges = charges.reduce((s, c) => s + c.montant, 0);
    const resultatNet = margeBrute - totalCharges;
    // Grouper charges par catégorie
    const parCat = {};
    for (const ch of charges) {
        if (!parCat[ch.categorieId])
            parCat[ch.categorieId] = { ...ch.categorie, total: 0, count: 0 };
        parCat[ch.categorieId].total += ch.montant;
        parCat[ch.categorieId].count++;
    }
    res.json({
        success: true,
        data: {
            periode: { debut, fin },
            ca, nbVentes: ventes._count,
            totalPertes, pertesMP: pertesMP._sum.valeur ?? 0, pertesPF: pertesPF._sum.valeur ?? 0,
            margeBrute, margeBrutePct: ca > 0 ? Math.round(margeBrute / ca * 100) : 0,
            totalCharges,
            chargesParCat: Object.values(parCat).sort((a, b) => b.total - a.total),
            resultatNet, resultatNetPct: ca > 0 ? Math.round(resultatNet / ca * 100) : 0,
        },
    });
});
exports.default = router;
//# sourceMappingURL=charges.routes.js.map