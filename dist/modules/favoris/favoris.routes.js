"use strict";
// src/modules/favoris/favoris.routes.ts
// Gestion des produits favoris en caisse
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const database_1 = __importDefault(require("../../config/database"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// GET /api/favoris — liste des favoris
router.get("/", async (req, res) => {
    const { companyId } = req.user;
    const favoris = await database_1.default.favorisProduit.findMany({
        where: { companyId },
        include: { produit: { select: { id: true, nom: true, prixVente: true, stockActuel: true, grammage: true } } },
        orderBy: { position: "asc" },
    });
    res.json({ success: true, data: favoris });
});
// POST /api/favoris — ajouter un favori
router.post("/", async (req, res) => {
    const { companyId } = req.user;
    const { produitId, position } = req.body;
    const favori = await database_1.default.favorisProduit.upsert({
        where: { companyId_produitId: { companyId, produitId } },
        update: { position: position ?? 0 },
        create: { companyId, produitId, position: position ?? 0 },
    });
    res.json({ success: true, data: favori });
});
// DELETE /api/favoris/:produitId — retirer un favori
router.delete("/:produitId", async (req, res) => {
    const { companyId } = req.user;
    await database_1.default.favorisProduit.deleteMany({
        where: { companyId, produitId: req.params.produitId },
    });
    res.json({ success: true });
});
// GET /api/stocks/mouvements/:mpId — historique mouvements d'une MP
router.get("/stocks/mouvements/:mpId", async (req, res) => {
    const mouvements = await database_1.default.mouvementStock.findMany({
        where: { mpId: req.params.mpId },
        orderBy: { createdAt: "desc" },
        take: 50,
    });
    res.json({ success: true, data: mouvements });
});
exports.default = router;
//# sourceMappingURL=favoris.routes.js.map