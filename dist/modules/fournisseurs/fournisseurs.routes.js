"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/fournisseurs/fournisseurs.routes.ts
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const database_1 = __importDefault(require("../../config/database"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
const fournisseurSchema = zod_1.z.object({
    nom: zod_1.z.string().min(2, "Le nom est requis"),
    contact: zod_1.z.string().optional(),
    telephone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    adresse: zod_1.z.string().optional(),
    delaiLivraison: zod_1.z.string().optional(),
    conditionsPaiement: zod_1.z.string().optional(),
});
// GET /api/fournisseurs
router.get("/", async (req, res) => {
    const fournisseurs = await database_1.default.fournisseur.findMany({
        where: { companyId: req.user.companyId, actif: true },
        include: {
            // Inclure les MP fournies pour l'affichage
            matieresPremieres: { select: { id: true, nom: true } },
        },
        orderBy: { nom: "asc" },
    });
    res.json({ success: true, data: fournisseurs });
});
// POST /api/fournisseurs
router.post("/", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]), async (req, res) => {
    const data = fournisseurSchema.parse(req.body);
    const fournisseur = await database_1.default.fournisseur.create({
        data: { ...data, companyId: req.user.companyId },
    });
    res.status(201).json({ success: true, data: fournisseur });
});
// PUT /api/fournisseurs/:id
router.put("/:id", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]), async (req, res) => {
    const data = fournisseurSchema.partial().parse(req.body);
    const fournisseur = await database_1.default.fournisseur.update({
        where: { id: req.params.id },
        data,
    });
    res.json({ success: true, data: fournisseur });
});
// DELETE /api/fournisseurs/:id (soft delete)
router.delete("/:id", (0, auth_middleware_1.requireRole)(["ADMIN"]), async (req, res) => {
    await database_1.default.fournisseur.update({
        where: { id: req.params.id },
        data: { actif: false },
    });
    res.json({ success: true, message: "Fournisseur désactivé" });
});
exports.default = router;
//# sourceMappingURL=fournisseurs.routes.js.map