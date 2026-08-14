"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/produits/produits.routes.ts
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const database_1 = __importDefault(require("../../config/database"));
const calculations_1 = require("../../utils/calculations");
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("cloudinary");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// ─── Config upload image produit ─────────────────────────────
// Stockage local si pas de Cloudinary configuré
const uploadDir = path_1.default.join(process.cwd(), "public", "uploads", "produits");
if (!fs_1.default.existsSync(uploadDir))
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        cb(null, `produit_${Date.now()}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (_req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        cb(null, allowed.includes(file.mimetype));
    },
});
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
const produitSchema = zod_1.z.object({
    nom: zod_1.z.string().min(2),
    prixVente: zod_1.z.number().positive("Le prix doit être positif"),
    margeMin: zod_1.z.number().min(0).max(100).default(25),
    grammage: zod_1.z.number().positive().optional().nullable(), // Poids d'une pièce en grammes
    categorieId: zod_1.z.string().optional(),
    recetteId: zod_1.z.string().optional(),
    seuilAlerte: zod_1.z.number().min(0).optional(),
});
// GET /api/produits — Lister les produits avec leurs marges calculées
router.get("/", async (req, res) => {
    const produits = await database_1.default.produit.findMany({
        where: { companyId: req.user.companyId, actif: true },
        include: {
            categorie: { select: { id: true, nom: true } },
            recette: { select: { id: true, nom: true } },
        },
        orderBy: { nom: "asc" },
    });
    // Calculer la marge de chaque produit
    const produitsAvecMarges = await Promise.all(produits.map(async (p) => ({
        ...p,
        ...(await (0, calculations_1.calculerMargeProduit)(p.id)),
    })));
    res.json({ success: true, data: produitsAvecMarges });
});
// POST /api/produits
router.post("/", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE"]), async (req, res) => {
    const data = produitSchema.parse(req.body);
    const produit = await database_1.default.produit.create({
        data: { ...data, companyId: req.user.companyId },
        include: { categorie: true, recette: true },
    });
    res.status(201).json({ success: true, data: produit });
});
// PUT /api/produits/:id
router.put("/:id", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE"]), async (req, res) => {
    const data = produitSchema.partial().parse(req.body);
    const produit = await database_1.default.produit.update({
        where: { id: req.params.id },
        data,
        include: { categorie: true, recette: true },
    });
    res.json({ success: true, data: produit });
});
// DELETE /api/produits/:id (soft delete)
router.delete("/:id", (0, auth_middleware_1.requireRole)(["ADMIN"]), async (req, res) => {
    await database_1.default.produit.update({
        where: { id: req.params.id },
        data: { actif: false },
    });
    res.json({ success: true, message: "Produit désactivé" });
});
// POST /api/produits/upload-image — Uploader une image produit
router.post("/upload-image", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]), (req, res) => {
    upload.single("image")(req, res, async (err) => {
        if (err instanceof multer_1.default.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({ success: false, message: "Image trop lourde (max 5MB)" });
            }
            return res.status(400).json({ success: false, message: err.message });
        }
        if (err)
            return res.status(400).json({ success: false, message: "Format non supporté (JPG, PNG, WebP)" });
        if (!req.file)
            return res.status(400).json({ success: false, message: "Aucun fichier reçu" });
        try {
            let imageUrl = "";
            // Si Cloudinary configuré → upload cloud
            if (process.env.CLOUDINARY_CLOUD_NAME) {
                const base64 = `data:${req.file.mimetype};base64,${fs_1.default.readFileSync(req.file.path).toString("base64")}`;
                const result = await cloudinary_1.v2.uploader.upload(base64, {
                    folder: "delice-pro/produits",
                    transformation: [{ width: 400, height: 400, crop: "fill", quality: "auto" }],
                });
                imageUrl = result.secure_url;
                fs_1.default.unlinkSync(req.file.path); // Supprimer le fichier local
            }
            else {
                // Sinon → URL locale servie par Express
                imageUrl = `/uploads/produits/${req.file.filename}`;
            }
            res.json({ success: true, data: { imageUrl } });
        }
        catch (error) {
            res.status(500).json({ success: false, message: "Erreur upload: " + error.message });
        }
    });
});
exports.default = router;
//# sourceMappingURL=produits.routes.js.map