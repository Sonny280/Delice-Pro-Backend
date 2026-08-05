// src/modules/fournisseurs/fournisseurs.routes.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import prisma from "../../config/database";

const router = Router();
router.use(authMiddleware);

const fournisseurSchema = z.object({
  nom: z.string().min(2, "Le nom est requis"),
  contact: z.string().optional(),
  telephone: z.string().optional(),
  email: z.string().email().optional(),
  adresse: z.string().optional(),
  delaiLivraison: z.string().optional(),
  conditionsPaiement: z.string().optional(),
});

// GET /api/fournisseurs
router.get("/", async (req: Request, res: Response) => {
  const fournisseurs = await prisma.fournisseur.findMany({
    where: { companyId: req.user!.companyId, actif: true },
    include: {
      // Inclure les MP fournies pour l'affichage
      matieresPremieres: { select: { id: true, nom: true } },
    },
    orderBy: { nom: "asc" },
  });
  res.json({ success: true, data: fournisseurs });
});

// POST /api/fournisseurs
router.post(
  "/",
  requireRole(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]),
  async (req: Request, res: Response) => {
    const data = fournisseurSchema.parse(req.body);
    const fournisseur = await prisma.fournisseur.create({
      data: { ...data, companyId: req.user!.companyId },
    });
    res.status(201).json({ success: true, data: fournisseur });
  }
);

// PUT /api/fournisseurs/:id
router.put(
  "/:id",
  requireRole(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]),
  async (req: Request, res: Response) => {
    const data = fournisseurSchema.partial().parse(req.body);
    const fournisseur = await prisma.fournisseur.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: fournisseur });
  }
);

// DELETE /api/fournisseurs/:id (soft delete)
router.delete(
  "/:id",
  requireRole(["ADMIN"]),
  async (req: Request, res: Response) => {
    await prisma.fournisseur.update({
      where: { id: req.params.id },
      data: { actif: false },
    });
    res.json({ success: true, message: "Fournisseur désactivé" });
  }
);

export default router;
