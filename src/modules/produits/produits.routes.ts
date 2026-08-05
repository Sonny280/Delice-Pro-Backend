// src/modules/produits/produits.routes.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import prisma from "../../config/database";
import { calculerMargeProduit } from "../../utils/calculations";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import path from "path";
import fs from "fs";

// ─── Config upload image produit ─────────────────────────────
// Stockage local si pas de Cloudinary configuré
const uploadDir = path.join(process.cwd(), "public", "uploads", "produits");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `produit_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();
router.use(authMiddleware);

const produitSchema = z.object({
  nom: z.string().min(2),
  prixVente: z.number().positive("Le prix doit être positif"),
  margeMin: z.number().min(0).max(100).default(25),
  grammage: z.number().positive().optional().nullable(), // Poids d'une pièce en grammes
  categorieId: z.string().optional(),
  recetteId: z.string().optional(),
  seuilAlerte: z.number().min(0).optional(),
});

// GET /api/produits — Lister les produits avec leurs marges calculées
router.get("/", async (req: Request, res: Response) => {
  const produits = await prisma.produit.findMany({
    where: { companyId: req.user!.companyId, actif: true },
    include: {
      categorie: { select: { id: true, nom: true } },
      recette: { select: { id: true, nom: true } },
    },
    orderBy: { nom: "asc" },
  });

  // Calculer la marge de chaque produit
  const produitsAvecMarges = await Promise.all(
    produits.map(async (p) => ({
      ...p,
      ...(await calculerMargeProduit(p.id)),
    }))
  );

  res.json({ success: true, data: produitsAvecMarges });
});

// POST /api/produits
router.post(
  "/",
  requireRole(["ADMIN", "RESPONSABLE"]),
  async (req: Request, res: Response) => {
    const data = produitSchema.parse(req.body);
    const produit = await prisma.produit.create({
      data: { ...data, companyId: req.user!.companyId },
      include: { categorie: true, recette: true },
    });
    res.status(201).json({ success: true, data: produit });
  }
);

// PUT /api/produits/:id
router.put(
  "/:id",
  requireRole(["ADMIN", "RESPONSABLE"]),
  async (req: Request, res: Response) => {
    const data = produitSchema.partial().parse(req.body);
    const produit = await prisma.produit.update({
      where: { id: req.params.id },
      data,
      include: { categorie: true, recette: true },
    });
    res.json({ success: true, data: produit });
  }
);

// DELETE /api/produits/:id (soft delete)
router.delete(
  "/:id",
  requireRole(["ADMIN"]),
  async (req: Request, res: Response) => {
    await prisma.produit.update({
      where: { id: req.params.id },
      data: { actif: false },
    });
    res.json({ success: true, message: "Produit désactivé" });
  }
);

// POST /api/produits/upload-image — Uploader une image produit
router.post("/upload-image",
  requireRole(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]),
  (req: Request, res: Response) => {
    upload.single("image")(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ success: false, message: "Image trop lourde (max 5MB)" });
        }
        return res.status(400).json({ success: false, message: err.message });
      }
      if (err) return res.status(400).json({ success: false, message: "Format non supporté (JPG, PNG, WebP)" });
      if (!req.file) return res.status(400).json({ success: false, message: "Aucun fichier reçu" });

      try {
        let imageUrl = "";

        // Si Cloudinary configuré → upload cloud
        if (process.env.CLOUDINARY_CLOUD_NAME) {
          const base64 = `data:${req.file.mimetype};base64,${fs.readFileSync(req.file.path).toString("base64")}`;
          const result = await cloudinary.uploader.upload(base64, {
            folder: "delice-pro/produits",
            transformation: [{ width: 400, height: 400, crop: "fill", quality: "auto" }],
          });
          imageUrl = result.secure_url;
          fs.unlinkSync(req.file.path); // Supprimer le fichier local
        } else {
          // Sinon → URL locale servie par Express
          imageUrl = `/uploads/produits/${req.file.filename}`;
        }

        res.json({ success: true, data: { imageUrl } });
      } catch (error: any) {
        res.status(500).json({ success: false, message: "Erreur upload: " + error.message });
      }
    });
  }
);

export default router;