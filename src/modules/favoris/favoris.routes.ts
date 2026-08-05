// src/modules/favoris/favoris.routes.ts
// Gestion des produits favoris en caisse

import { Router, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import prisma from "../../config/database";

const router = Router();
router.use(authMiddleware);

// GET /api/favoris — liste des favoris
router.get("/", async (req: Request, res: Response) => {
  const { companyId } = req.user!;
  const favoris = await (prisma as any).favorisProduit.findMany({
    where: { companyId },
    include: { produit: { select: { id: true, nom: true, prixVente: true, stockActuel: true, grammage: true } } },
    orderBy: { position: "asc" },
  });
  res.json({ success: true, data: favoris });
});

// POST /api/favoris — ajouter un favori
router.post("/", async (req: Request, res: Response) => {
  const { companyId } = req.user!;
  const { produitId, position } = req.body;
  const favori = await (prisma as any).favorisProduit.upsert({
    where: { companyId_produitId: { companyId, produitId } },
    update: { position: position ?? 0 },
    create: { companyId, produitId, position: position ?? 0 },
  });
  res.json({ success: true, data: favori });
});

// DELETE /api/favoris/:produitId — retirer un favori
router.delete("/:produitId", async (req: Request, res: Response) => {
  const { companyId } = req.user!;
  await (prisma as any).favorisProduit.deleteMany({
    where: { companyId, produitId: req.params.produitId },
  });
  res.json({ success: true });
});

// GET /api/stocks/mouvements/:mpId — historique mouvements d'une MP
router.get("/stocks/mouvements/:mpId", async (req: Request, res: Response) => {
  const mouvements = await prisma.mouvementStock.findMany({
    where: { mpId: req.params.mpId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ success: true, data: mouvements });
});


export default router;
