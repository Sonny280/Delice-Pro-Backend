// ═══════════════════════════════════════════════════════════════
// src/modules/categories/categories.routes.ts
// CRUD pour les catégories (produits et matières premières)
// ═══════════════════════════════════════════════════════════════

import { Router, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import prisma from "../../config/database";

const router = Router();
router.use(authMiddleware);

const categorieSchema = z.object({
  nom: z.string().min(2, "Le nom est requis"),
  type: z.enum(["PRODUIT", "MATIERE_PREMIERE"]),
  margeMin: z.number().optional(),
});

// GET /api/categories — Lister toutes les catégories
router.get("/", async (req: Request, res: Response) => {
  const { type } = req.query;
  const categories = await prisma.categorie.findMany({
    where: {
      companyId: req.user!.companyId,
      ...(type ? { type: type as "PRODUIT" | "MATIERE_PREMIERE" } : {}),
    },
    orderBy: { nom: "asc" },
  });
  res.json({ success: true, data: categories });
});

// POST /api/categories — Créer une catégorie
router.post(
  "/",
  requireRole(["ADMIN", "RESPONSABLE"]),
  async (req: Request, res: Response) => {
    const data = categorieSchema.parse(req.body);
    const categorie = await prisma.categorie.create({
      data: { ...data, companyId: req.user!.companyId },
    });
    res.status(201).json({ success: true, data: categorie });
  }
);

// PUT /api/categories/:id
router.put(
  "/:id",
  requireRole(["ADMIN", "RESPONSABLE"]),
  async (req: Request, res: Response) => {
    const data = categorieSchema.partial().parse(req.body);
    const categorie = await prisma.categorie.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: categorie });
  }
);

export default router;
