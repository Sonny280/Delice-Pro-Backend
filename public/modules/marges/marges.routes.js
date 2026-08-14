"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/marges/marges.routes.ts
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const marges_service_1 = require("./marges.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// GET /api/marges
router.get("/", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE", "COMPTABLE", "CHEF_PATISSIER"]), async (req, res) => {
    const result = await (0, marges_service_1.getMargesTousProduits)(req.user.companyId);
    res.json({ success: true, data: result });
});
// GET /api/marges/categories
router.get("/categories", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE", "COMPTABLE"]), async (req, res) => {
    const result = await (0, marges_service_1.getMargesParCategorie)(req.user.companyId);
    res.json({ success: true, data: result });
});
// POST /api/marges/simuler
// Body: { variations: [{ mpId, variation }] }
router.post("/simuler", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]), async (req, res) => {
    const { variations } = req.body;
    if (!Array.isArray(variations)) {
        res.status(400).json({ success: false, message: "variations[] requis" });
        return;
    }
    const result = await (0, marges_service_1.simulerImpactHausse)(req.user.companyId, variations);
    res.json({ success: true, data: result });
});
exports.default = router;
//# sourceMappingURL=marges.routes.js.map