"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/clients/clients.routes.ts
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const database_1 = __importDefault(require("../../config/database"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
const clientSchema = zod_1.z.object({
    nom: zod_1.z.string().min(2),
    type: zod_1.z.enum(["PARTICULIER", "PROFESSIONNEL"]).default("PARTICULIER"),
    telephone: zod_1.z.string().optional(),
    email: zod_1.z.string().optional(),
    adresse: zod_1.z.string().optional(),
    entreprise: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
router.get("/", async (req, res) => {
    const clients = await database_1.default.client.findMany({
        where: { companyId: req.user.companyId, actif: true },
        include: { _count: { select: { commandes: true } } },
        orderBy: { nom: "asc" },
    });
    res.json({ success: true, data: clients });
});
router.post("/", async (req, res) => {
    const data = clientSchema.parse(req.body);
    const client = await database_1.default.client.create({
        data: { ...data, companyId: req.user.companyId },
    });
    res.status(201).json({ success: true, data: client });
});
router.put("/:id", async (req, res) => {
    const data = clientSchema.partial().parse(req.body);
    const client = await database_1.default.client.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: client });
});
router.delete("/:id", (0, auth_middleware_1.requireRole)(["ADMIN"]), async (req, res) => {
    await database_1.default.client.update({ where: { id: req.params.id }, data: { actif: false } });
    res.json({ success: true });
});
exports.default = router;
//# sourceMappingURL=clients.routes.js.map