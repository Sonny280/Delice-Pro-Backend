"use strict";
// ═══════════════════════════════════════════════════════════════
// src/modules/categories/categories.routes.ts
// CRUD pour les catégories (produits et matières premières)
// ═══════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const database_1 = __importDefault(require("../../config/database"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
const categorieSchema = zod_1.z.object({
    nom: zod_1.z.string().min(2, "Le nom est requis"),
    type: zod_1.z.enum(["PRODUIT", "MATIERE_PREMIERE"]),
    margeMin: zod_1.z.number().optional(),
});
// GET /api/categories — Lister toutes les catégories
router.get("/", async (req, res) => {
    const { type } = req.query;
    const categories = await database_1.default.categorie.findMany({
        where: {
            companyId: req.user.companyId,
            ...(type ? { type: type } : {}),
        },
        orderBy: { nom: "asc" },
    });
    res.json({ success: true, data: categories });
});
// POST /api/categories — Créer une catégorie
router.post("/", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE"]), async (req, res) => {
    const data = categorieSchema.parse(req.body);
    const categorie = await database_1.default.categorie.create({
        data: { ...data, companyId: req.user.companyId },
    });
    res.status(201).json({ success: true, data: categorie });
});
// PUT /api/categories/:id
router.put("/:id", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE"]), async (req, res) => {
    const data = categorieSchema.partial().parse(req.body);
    const categorie = await database_1.default.categorie.update({
        where: { id: req.params.id },
        data,
    });
    res.json({ success: true, data: categorie });
});
exports.default = router;
//# sourceMappingURL=categories.routes.js.map