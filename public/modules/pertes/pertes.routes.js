"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/pertes/pertes.routes.ts
// VERSION SQLITE — prisma importé explicitement pour eviter "possibly undefined"
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const pertes_service_1 = require("./pertes.service");
const database_1 = __importDefault(require("../../config/database")); // import direct
// Import explicite pour eviter "possibly undefined"
const db = database_1.default;
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// GET /api/pertes
router.get("/", async (req, res) => {
    const { type, cause, dateDebut, dateFin, limit } = req.query;
    const result = await (0, pertes_service_1.getPertes)(req.user.companyId, {
        type: type,
        cause: cause,
        dateDebut: dateDebut,
        dateFin: dateFin,
        limit: limit ? parseInt(limit) : undefined,
    });
    res.json({ success: true, data: result });
});
// GET /api/pertes/causes
router.get("/causes", async (_req, res) => {
    res.json({ success: true, data: { produit: pertes_service_1.CAUSES_PRODUIT_FINI, mp: pertes_service_1.CAUSES_MATIERE_PREMIERE } });
});
// POST /api/pertes/produit
router.post("/produit", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "CAISSIER", "GESTIONNAIRE"]), async (req, res) => {
    const data = pertes_service_1.createPerteProduitSchema.parse(req.body);
    const result = await (0, pertes_service_1.createPerteProduit)(req.user.companyId, data);
    res.status(201).json({ success: true, data: result });
});
// POST /api/pertes/mp
router.post("/mp", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "CHEF_PATISSIER", "GESTIONNAIRE"]), async (req, res) => {
    const data = pertes_service_1.createPerteMPSchema.parse(req.body);
    const result = await (0, pertes_service_1.createPerteMP)(req.user.companyId, data);
    res.status(201).json({ success: true, data: result });
});
// DELETE /api/pertes/:id
router.delete("/:id", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE"]), async (req, res) => {
    try {
        const { id } = req.params;
        const perte = await db.perte.findFirst({
            where: { id, companyId: req.user.companyId },
            include: { produit: true, mp: true },
        });
        if (!perte)
            return res.status(404).json({ success: false, message: "Perte introuvable" });
        if (perte.type === "PRODUIT_FINI" && perte.produitId) {
            await db.produit.update({
                where: { id: perte.produitId },
                data: { stockActuel: { increment: perte.quantite } },
            });
        }
        if (perte.type === "MATIERE_PREMIERE" && perte.mpId) {
            await db.matierePremiere.update({
                where: { id: perte.mpId },
                data: { stockActuel: { increment: perte.quantite } },
            });
        }
        await db.perte.delete({ where: { id } });
        res.json({ success: true, message: "Perte supprimee et stock restitue" });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// GET /api/pertes/export
router.get("/export", async (req, res) => {
    try {
        const pertes = await db.perte.findMany({
            where: { companyId: req.user.companyId },
            include: {
                produit: { select: { nom: true } },
                mp: { select: { nom: true } },
            },
            orderBy: { date: "desc" },
        });
        const rows = [
            ["Date", "Type", "Produit/MP", "Quantite", "Cause", "Valeur", "Notes"].join(";"),
            ...pertes.map((p) => [
                new Date(p.date).toLocaleDateString("fr-FR"),
                p.type === "PRODUIT_FINI" ? "Produit fini" : "Matiere premiere",
                p.produit?.nom ?? p.mp?.nom ?? "",
                p.quantite,
                p.cause,
                p.valeur?.toFixed(2) ?? "0.00",
                p.notes ?? "",
            ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
        ].join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", "attachment; filename=pertes.csv");
        res.send("\uFEFF" + rows);
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=pertes.routes.js.map