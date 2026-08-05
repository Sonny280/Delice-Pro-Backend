"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/company/company.routes.ts
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const database_1 = __importDefault(require("../../config/database"));
const auth_middleware_1 = require("../../middleware/auth.middleware");
const company_service_1 = require("./company.service");
const router = (0, express_1.Router)();
// ── Route PUBLIQUE (avant authMiddleware) ────────────────────────
// Liste des boulangeries pour la page de login
// Pas d'authentification requise
router.get("/list-public", async (_req, res) => {
    const companies = await database_1.default.company.findMany({
        select: { id: true, nom: true, ville: true },
        orderBy: { nom: "asc" },
    });
    res.json({ success: true, data: companies });
});
// ── Routes PRIVÉES (avec authMiddleware) ─────────────────────────
router.use(auth_middleware_1.authMiddleware);
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 500 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        }
        else {
            cb(new Error("Seules les images sont acceptées (PNG, JPG, SVG, WebP)"));
        }
    },
});
// GET /api/company
router.get("/", async (req, res) => {
    const company = await (0, company_service_1.getCompany)(req.user.companyId);
    res.json({ success: true, data: company });
});
// PUT /api/company
router.put("/", (0, auth_middleware_1.requireRole)(["ADMIN"]), async (req, res) => {
    const data = company_service_1.updateCompanySchema.parse(req.body);
    const company = await (0, company_service_1.updateCompany)(req.user.companyId, data);
    res.json({ success: true, data: company });
});
// POST /api/company/logo
router.post("/logo", (0, auth_middleware_1.requireRole)(["ADMIN"]), (req, res, next) => {
    upload.single("logo")(req, res, (err) => {
        if (err instanceof multer_1.default.MulterError && err.code === "LIMIT_FILE_SIZE") {
            res.status(400).json({
                success: false,
                message: "Logo trop lourd. Maximum 500 Ko. Compressez sur https://squoosh.app/",
            });
            return;
        }
        if (err) {
            res.status(400).json({ success: false, message: err.message });
            return;
        }
        next();
    });
}, async (req, res) => {
    if (!req.file) {
        res.status(400).json({ success: false, message: "Aucun fichier reçu" });
        return;
    }
    const logoUrl = await (0, company_service_1.uploadLogo)(req.user.companyId, req.file.buffer, req.file.mimetype);
    res.json({ success: true, data: { logoUrl } });
});
// GET /api/company/dashboard
router.get("/dashboard", async (req, res) => {
    const data = await (0, company_service_1.getDashboardData)(req.user.companyId);
    res.json({ success: true, data });
});
exports.default = router;
//# sourceMappingURL=company.routes.js.map