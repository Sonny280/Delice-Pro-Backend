"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/recettes/recettes.routes.ts
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const recettes_service_1 = require("./recettes.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// GET /api/recettes
router.get("/", async (req, res) => {
    const recettes = await (0, recettes_service_1.getRecettes)(req.user.companyId);
    res.json({ success: true, data: recettes });
});
// POST /api/recettes
router.post("/", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "CHEF_PATISSIER"]), async (req, res) => {
    const data = recettes_service_1.createRecetteSchema.parse(req.body);
    const recette = await (0, recettes_service_1.createRecette)(req.user.companyId, data);
    res.status(201).json({ success: true, data: recette });
});
// PUT /api/recettes/:id
router.put("/:id", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "CHEF_PATISSIER"]), async (req, res) => {
    const data = recettes_service_1.updateRecetteSchema.parse(req.body);
    const recette = await (0, recettes_service_1.updateRecette)(req.params.id, req.user.companyId, data);
    res.json({ success: true, data: recette });
});
// POST /api/recettes/:id/dupliquer
router.post("/:id/dupliquer", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "CHEF_PATISSIER"]), async (req, res) => {
    const copie = await (0, recettes_service_1.dupliquerRecette)(req.params.id, req.user.companyId);
    res.status(201).json({ success: true, data: copie });
});
// DELETE /api/recettes/:id  (archivage soft)
router.delete("/:id", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE"]), async (req, res) => {
    await (0, recettes_service_1.archiverRecette)(req.params.id, req.user.companyId);
    res.json({ success: true, message: "Recette archivee" });
});
exports.default = router;
//# sourceMappingURL=recettes.routes.js.map