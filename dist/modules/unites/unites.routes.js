"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/unites/unites.routes.ts
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const database_1 = __importDefault(require("../../config/database"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
const uniteSchema = zod_1.z.object({
    nom: zod_1.z.string().min(2),
    abreviation: zod_1.z.string().min(1),
    type: zod_1.z.enum(["MASSE", "VOLUME", "COMPTAGE", "CONDITIONNEMENT"]),
    uniteBase: zod_1.z.string(),
    coefficient: zod_1.z.number().positive("Le coefficient doit être positif"),
});
router.get("/", async (req, res) => {
    const unites = await database_1.default.unite.findMany({
        where: { companyId: req.user.companyId },
        orderBy: { nom: "asc" },
    });
    res.json({ success: true, data: unites });
});
router.post("/", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE"]), async (req, res) => {
    const data = uniteSchema.parse(req.body);
    const unite = await database_1.default.unite.create({
        data: { ...data, companyId: req.user.companyId },
    });
    res.status(201).json({ success: true, data: unite });
});
router.put("/:id", (0, auth_middleware_1.requireRole)(["ADMIN"]), async (req, res) => {
    const data = uniteSchema.partial().parse(req.body);
    const unite = await database_1.default.unite.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: unite });
});
exports.default = router;
//# sourceMappingURL=unites.routes.js.map