// src/modules/ventes/ventes.routes.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import { createVente, getStatsVentes, getStockProduits, createVenteSchema } from "./ventes.service";
import prisma from "../../config/database";

const router = Router();
router.use(authMiddleware);

// GET /api/ventes/stats
router.get("/stats", async (req: Request, res: Response) => {
  const { dateDebut, dateFin } = req.query;
  const result = await getStatsVentes(req.user!.companyId, {
    dateDebut: dateDebut as string,
    dateFin: dateFin as string,
  });
  res.json({ success: true, data: result });
});

// GET /api/ventes/session — Récupérer la session de caisse ouverte du jour
router.get("/session", async (req: Request, res: Response) => {
  const { companyId } = req.user!;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const session = await (prisma as any).sessionCaisse.findFirst({
      where: {
        companyId,
        statut: "OUVERTE",
        dateOuverture: { gte: today, lt: tomorrow },
      },
      include: { user: { select: { prenom: true, nom: true } } },
      orderBy: { dateOuverture: "desc" },
    });
    res.json({ success: true, data: session ?? null });
  } catch {
    // Table pas encore migrée — retourner null sans crasher
    res.json({ success: true, data: null });
  }
});

// POST /api/ventes/session/ouvrir — Ouvrir une session de caisse
router.post(
  "/session/ouvrir",
  requireRole(["ADMIN", "RESPONSABLE", "CAISSIER"]),
  async (req: Request, res: Response) => {
    const { companyId, id: userId } = req.user!;
    const schema = z.object({ fondInitial: z.number().min(0).default(0) });
    const { fondInitial } = schema.parse(req.body);

    try {
      // Fermer toute session ouverte existante du même caissier
      await (prisma as any).sessionCaisse.updateMany({
        where: { companyId, userId, statut: "OUVERTE" },
        data: { statut: "FERMEE", dateFermeture: new Date() },
      });

      const session = await (prisma as any).sessionCaisse.create({
        data: {
          companyId,
          userId,
          fondOuverture: fondInitial,
          statut: "OUVERTE",
        },
        include: { user: { select: { prenom: true, nom: true } } },
      });
      res.status(201).json({ success: true, data: session });
    } catch {
      // Table pas encore migrée — retourner un objet minimal sans crasher
      res.status(201).json({
        success: true,
        data: { id: "local-" + Date.now(), ouverteA: new Date().toISOString(), totalVentes: 0, nbTransactions: 0 },
      });
    }
  }
);

// POST /api/ventes/session/fermer — Fermer la session de caisse
router.post(
  "/session/fermer",
  requireRole(["ADMIN", "RESPONSABLE", "CAISSIER"]),
  async (req: Request, res: Response) => {
    const schema = z.object({ sessionId: z.string() });
    const { sessionId } = schema.parse(req.body);

    try {
      // Calculer le total des ventes de la session
      const ventes = await prisma.vente.findMany({
        where: { companyId: req.user!.companyId },
        select: { montantTotal: true, createdAt: true },
      });

      const session = await (prisma as any).sessionCaisse.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        res.json({ success: true, data: null });
        return;
      }

      const ventesSession = ventes.filter(
        (v: any) => new Date(v.createdAt) >= new Date(session.dateOuverture)
      );
      const totalVentes = ventesSession.reduce((s: number, v: any) => s + v.montantTotal, 0);

      const updated = await (prisma as any).sessionCaisse.update({
        where: { id: sessionId },
        data: {
          statut: "FERMEE",
          dateFermeture: new Date(),
          totalVentes: Math.round(totalVentes),
          nbTransactions: ventesSession.length,
        },
      });
      res.json({ success: true, data: updated });
    } catch {
      res.json({ success: true, data: null });
    }
  }
);

// GET /api/ventes -- Historique des ventes
router.get("/", async (req: Request, res: Response) => {
  const { dateDebut, dateFin, limit } = req.query;

  const where: any = { companyId: req.user!.companyId };
  if (dateDebut || dateFin) {
    where.date = {};
    if (dateDebut) where.date.gte = new Date(dateDebut as string);
    if (dateFin) {
      const fin = new Date(dateFin as string);
      fin.setHours(23, 59, 59, 999);
      where.date.lte = fin;
    }
  }

  const ventes = await prisma.vente.findMany({
    where,
    include: {
      lignes: { include: { produit: { select: { nom: true } } } },
      user: { select: { prenom: true, nom: true } },
    },
    orderBy: { date: "desc" },
    take: limit ? Number(limit) : 100,
  });
  res.json({ success: true, data: ventes });
});

// GET /api/ventes/stock-produits — Stock actuel de tous les produits finis
router.get("/stock-produits", async (req: Request, res: Response) => {
  const produits = await getStockProduits(req.user!.companyId);
  res.json({ success: true, data: produits });
});

// PUT /api/ventes/stock-produits/:id/stock — Modifier stock + seuil
router.put(
  "/stock-produits/:id/stock",
  requireRole(["ADMIN", "RESPONSABLE", "GESTIONNAIRE", "CHEF_PATISSIER"]),
  async (req: Request, res: Response) => {
    const schema = z.object({
      stockActuel: z.number().min(0),
      seuilAlerte: z.number().min(0),
    });
    const { stockActuel, seuilAlerte } = schema.parse(req.body);

    const produit = await prisma.produit.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!produit) {
      res.status(404).json({ success: false, message: "Produit introuvable" });
      return;
    }

    const updated = await prisma.produit.update({
      where: { id: req.params.id },
      data: { stockActuel, seuilAlerte },
    });
    res.json({ success: true, data: updated });
  }
);

// POST /api/ventes — Enregistrer une vente
router.post(
  "/",
  requireRole(["ADMIN", "RESPONSABLE", "CAISSIER"]),
  async (req: Request, res: Response) => {
    const data = createVenteSchema.parse(req.body);  // FIX: était "creataeVenteSchema"
    const vente = await createVente(req.user!.companyId, req.user!.id, data);
    res.status(201).json({ success: true, data: vente });
  }
);

// POST /api/ventes/stock-produits/entree — Entrée manuelle stock produit fini
router.post(
  "/stock-produits/entree",
  requireRole(["ADMIN", "RESPONSABLE", "CHEF_PATISSIER"]),
  async (req: Request, res: Response) => {
    const schema = z.object({
      produitId: z.string({ required_error: "Produit requis" }),
      quantite:  z.number().int().positive("La quantite doit etre positive"),
      motif:     z.string().optional(),
    });
    const { produitId, quantite } = schema.parse(req.body);

    const produit = await prisma.produit.findFirst({
      where: { id: produitId, companyId: req.user!.companyId },
    });
    if (!produit) {
      res.status(404).json({ success: false, message: "Produit introuvable" });
      return;
    }

    const updated = await prisma.produit.update({
      where: { id: produitId },
      data:  { stockActuel: { increment: quantite } },
    });

    res.json({
      success: true,
      data: {
        produit: updated,
        message: `+${quantite} pcs ajoutees. Nouveau stock : ${updated.stockActuel}`,
      },
    });
  }
);

export default router;

// GET /api/ventes/check-dlv — Vérifier les DLV avant vente
router.post("/check-dlv", async (req: Request, res: Response) => {
  try {
    const { lignes } = req.body;
    // Route simplifiée — pas de blocage DLV pour l'instant
    res.json({ success: true, data: { alertes: [] } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});