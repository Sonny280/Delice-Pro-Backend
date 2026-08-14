"use strict";
// ═══════════════════════════════════════════════════════════════
// src/modules/matieresPremières/mp.controller.ts + mp.routes.ts
// ═══════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMPController = listMPController;
exports.createMPController = createMPController;
exports.updateMPController = updateMPController;
exports.deleteMPController = deleteMPController;
exports.entreeStockController = entreeStockController;
exports.mouvementsController = mouvementsController;
const express_1 = require("express");
const mp_service_1 = require("./mp.service");
const auth_middleware_1 = require("../../middleware/auth.middleware");
// ─── CONTROLLER ──────────────────────────────────────────────────
// GET /api/mp — Lister toutes les MP
async function listMPController(req, res) {
    const mps = await (0, mp_service_1.getMPList)(req.user.companyId);
    res.json({ success: true, data: mps });
}
// POST /api/mp — Créer une MP
async function createMPController(req, res) {
    const data = mp_service_1.createMPSchema.parse(req.body);
    const mp = await (0, mp_service_1.createMP)(req.user.companyId, data);
    res.status(201).json({ success: true, data: mp });
}
// PUT /api/mp/:id — Modifier une MP
async function updateMPController(req, res) {
    const data = mp_service_1.updateMPSchema.parse(req.body);
    const mp = await (0, mp_service_1.updateMP)(req.params.id, req.user.companyId, data);
    res.json({ success: true, data: mp });
}
// DELETE /api/mp/:id — Désactiver une MP
async function deleteMPController(req, res) {
    await (0, mp_service_1.deleteMP)(req.params.id, req.user.companyId);
    res.json({ success: true, message: "Matière première désactivée" });
}
// POST /api/mp/entree — Entrée de stock
async function entreeStockController(req, res) {
    const data = mp_service_1.entreeStockSchema.parse(req.body);
    const mp = await (0, mp_service_1.entreeStock)(req.user.companyId, data);
    res.json({ success: true, data: mp });
}
// GET /api/mp/:id/mouvements — Historique mouvements
async function mouvementsController(req, res) {
    const mouvements = await (0, mp_service_1.getMouvementsStock)(req.params.id, req.user.companyId);
    res.json({ success: true, data: mouvements });
}
// ─── ROUTES ──────────────────────────────────────────────────────
const router = (0, express_1.Router)();
// Toutes les routes MP nécessitent d'être connecté
router.use(auth_middleware_1.authMiddleware);
router.get("/", listMPController);
router.post("/", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE", "CHEF_PATISSIER"]), createMPController);
router.put("/:id", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]), updateMPController);
router.delete("/:id", (0, auth_middleware_1.requireRole)(["ADMIN"]), deleteMPController);
router.post("/entree", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]), entreeStockController);
router.get("/:id/mouvements", mouvementsController);
exports.default = router;
//# sourceMappingURL=mp.routes.js.map