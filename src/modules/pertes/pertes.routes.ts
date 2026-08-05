// src/modules/pertes/pertes.routes.ts
// VERSION SQLITE — prisma importé explicitement pour eviter "possibly undefined"
import { Router, Request, Response } from "express";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import {
  createPerteProduit, createPerteMP, getPertes,
  createPerteProduitSchema, createPerteMPSchema,
  CAUSES_PRODUIT_FINI, CAUSES_MATIERE_PREMIERE,
} from "./pertes.service";
import prismaClient from "../../config/database"; // import direct

// Import explicite pour eviter "possibly undefined"
const db = prismaClient;

const router = Router();
router.use(authMiddleware);

// GET /api/pertes
router.get("/", async (req: Request, res: Response) => {
  const { type, cause, dateDebut, dateFin, limit } = req.query;
  const result = await getPertes(req.user!.companyId, {
    type:      type      as "PRODUIT_FINI" | "MATIERE_PREMIERE" | undefined,
    cause:     cause     as string | undefined,
    dateDebut: dateDebut as string | undefined,
    dateFin:   dateFin   as string | undefined,
    limit:     limit ? parseInt(limit as string) : undefined,
  });
  res.json({ success: true, data: result });
});

// GET /api/pertes/causes
router.get("/causes", async (_req: Request, res: Response) => {
  res.json({ success: true, data: { produit: CAUSES_PRODUIT_FINI, mp: CAUSES_MATIERE_PREMIERE } });
});

// POST /api/pertes/produit
router.post("/produit",
  requireRole(["ADMIN", "RESPONSABLE", "CAISSIER", "GESTIONNAIRE"]),
  async (req: Request, res: Response) => {
    const data   = createPerteProduitSchema.parse(req.body);
    const result = await createPerteProduit(req.user!.companyId, data);
    res.status(201).json({ success: true, data: result });
  }
);

// POST /api/pertes/mp
router.post("/mp",
  requireRole(["ADMIN", "RESPONSABLE", "CHEF_PATISSIER", "GESTIONNAIRE"]),
  async (req: Request, res: Response) => {
    const data   = createPerteMPSchema.parse(req.body);
    const result = await createPerteMP(req.user!.companyId, data);
    res.status(201).json({ success: true, data: result });
  }
);

// DELETE /api/pertes/:id
router.delete("/:id", requireRole(["ADMIN", "RESPONSABLE"]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const perte = await db.perte.findFirst({
      where: { id, companyId: req.user!.companyId },
      include: { produit: true, mp: true },
    });
    if (!perte) return res.status(404).json({ success: false, message: "Perte introuvable" });

    if ((perte as any).type === "PRODUIT_FINI" && (perte as any).produitId) {
      await db.produit.update({
        where: { id: (perte as any).produitId },
        data:  { stockActuel: { increment: (perte as any).quantite } },
      });
    }
    if ((perte as any).type === "MATIERE_PREMIERE" && (perte as any).mpId) {
      await db.matierePremiere.update({
        where: { id: (perte as any).mpId },
        data:  { stockActuel: { increment: (perte as any).quantite } },
      });
    }

    await db.perte.delete({ where: { id } });
    res.json({ success: true, message: "Perte supprimee et stock restitue" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/pertes/export
router.get("/export", async (req: Request, res: Response) => {
  try {
    const pertes = await db.perte.findMany({
      where:   { companyId: req.user!.companyId },
      include: {
        produit: { select: { nom: true } },
        mp:      { select: { nom: true } },
      },
      orderBy: { date: "desc" },
    });

    const rows = [
      ["Date", "Type", "Produit/MP", "Quantite", "Cause", "Valeur", "Notes"].join(";"),
      ...pertes.map((p: any) => [
        new Date(p.date).toLocaleDateString("fr-FR"),
        p.type === "PRODUIT_FINI" ? "Produit fini" : "Matiere premiere",
        p.produit?.nom ?? p.mp?.nom ?? "",
        p.quantite,
        p.cause,
        p.valeur?.toFixed(2) ?? "0.00",
        p.notes ?? "",
      ].map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
    ].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=pertes.csv");
    res.send("\uFEFF" + rows);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

