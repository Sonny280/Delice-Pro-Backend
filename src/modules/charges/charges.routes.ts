// src/modules/charges/charges.routes.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import prisma from "../../config/database";

const router = Router();
router.use(authMiddleware);

// ── Catégories ────────────────────────────────────────────────

router.get("/categories", async (req: Request, res: Response) => {
  const cats = await (prisma as any).categorieCharge.findMany({
    where: { companyId: req.user!.companyId, actif: true },
    orderBy: { ordre: "asc" },
    include: { _count: { select: { charges: true } } },
  });
  res.json({ success: true, data: cats });
});

router.post("/categories", requireRole(["ADMIN","RESPONSABLE"]), async (req: Request, res: Response) => {
  const { nom, icone = "📋", couleur = "#6B7280" } = req.body;
  if (!nom) return res.status(400).json({ success: false, message: "Nom obligatoire" });
  const companyId = req.user!.companyId;
  const last = await (prisma as any).categorieCharge.findFirst({ where: { companyId }, orderBy: { ordre: "desc" } });
  const cat  = await (prisma as any).categorieCharge.create({ data: { nom, icone, couleur, ordre: (last?.ordre ?? 0) + 1, companyId } });
  res.json({ success: true, data: cat });
});

router.put("/categories/:id", requireRole(["ADMIN","RESPONSABLE"]), async (req: Request, res: Response) => {
  const { nom, icone, couleur } = req.body;
  await (prisma as any).categorieCharge.updateMany({ where: { id: req.params.id, companyId: req.user!.companyId }, data: { nom, icone, couleur } });
  res.json({ success: true });
});

router.delete("/categories/:id", requireRole(["ADMIN","RESPONSABLE"]), async (req: Request, res: Response) => {
  const companyId = req.user!.companyId;
  const count = await (prisma as any).charge.count({ where: { categorieId: req.params.id, companyId } });
  if (count > 0) return res.status(400).json({ success: false, message: `${count} charge(s) liée(s) — supprimez-les d'abord` });
  await (prisma as any).categorieCharge.updateMany({ where: { id: req.params.id, companyId }, data: { actif: false } });
  res.json({ success: true });
});

// ── Charges ───────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  const { dateDebut, dateFin, categorieId, recurrence } = req.query as any;
  const companyId = req.user!.companyId;
  const where: any = { companyId };
  if (categorieId) where.categorieId = categorieId;
  if (recurrence)  where.recurrence  = recurrence;
  if (dateDebut || dateFin) {
    where.date = {};
    if (dateDebut) where.date.gte = new Date(dateDebut);
    if (dateFin)   where.date.lte = new Date(new Date(dateFin).setHours(23,59,59,999));
  }
  const charges = await (prisma as any).charge.findMany({
    where, include: { categorie: { select: { nom: true, icone: true, couleur: true } } },
    orderBy: { date: "desc" },
  });
  const totalCharges = charges.reduce((s: number, c: any) => s + c.montant, 0);
  res.json({ success: true, data: { charges, totalCharges } });
});

router.post("/", requireRole(["ADMIN","RESPONSABLE","GESTIONNAIRE"]), async (req: Request, res: Response) => {
  const schema = z.object({
    libelle: z.string().min(1),
    // CORRECTION 🟡 : Montant max pour éviter erreurs de saisie
    montant: z.number().positive("Montant doit être positif").max(10_000_000, "Montant trop élevé"),
    date: z.string().default(new Date().toISOString()),
    categorieId: z.string(), notes: z.string().optional(),
    recurrence: z.enum(["PONCTUELLE","MENSUELLE","ANNUELLE"]).default("PONCTUELLE"),
  });
  const data = schema.parse(req.body);
  const companyId = req.user!.companyId;
  const cat = await (prisma as any).categorieCharge.findFirst({ where: { id: data.categorieId, companyId } });
  if (!cat) return res.status(404).json({ success: false, message: "Catégorie introuvable" });
  const charge = await (prisma as any).charge.create({
    data: { ...data, date: new Date(data.date), companyId },
    include: { categorie: { select: { nom: true, icone: true, couleur: true } } },
  });
  res.json({ success: true, data: charge });
});

router.put("/:id", requireRole(["ADMIN","RESPONSABLE","GESTIONNAIRE"]), async (req: Request, res: Response) => {
  const schema = z.object({
    libelle: z.string().min(1).optional(), montant: z.number().positive().optional(),
    date: z.string().optional(), categorieId: z.string().optional(),
    notes: z.string().optional(),
    recurrence: z.enum(["PONCTUELLE","MENSUELLE","ANNUELLE"]).optional(),
  });
  const data = schema.parse(req.body);
  await (prisma as any).charge.updateMany({
    where: { id: req.params.id, companyId: req.user!.companyId },
    data: { ...data, ...(data.date ? { date: new Date(data.date) } : {}) },
  });
  res.json({ success: true });
});

router.delete("/:id", requireRole(["ADMIN","RESPONSABLE"]), async (req: Request, res: Response) => {
  await (prisma as any).charge.deleteMany({ where: { id: req.params.id, companyId: req.user!.companyId } });
  res.json({ success: true });
});

// ── Synthèse financière ───────────────────────────────────────

router.get("/synthese", async (req: Request, res: Response) => {
  const { dateDebut, dateFin } = req.query as any;
  const companyId = req.user!.companyId;
  const debut = dateDebut ? new Date(dateDebut) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const fin   = dateFin   ? new Date(new Date(dateFin).setHours(23,59,59,999)) : new Date();

  const [ventes, pertesMP, pertesPF, charges] = await Promise.all([
    prisma.vente.aggregate({ where: { companyId, date: { gte: debut, lte: fin }, statut: "VALIDEE" }, _sum: { montantTotal: true }, _count: true }),
    prisma.perte.aggregate({ where: { companyId, date: { gte: debut, lte: fin }, type: "MATIERE_PREMIERE" }, _sum: { valeur: true } }),
    prisma.perte.aggregate({ where: { companyId, date: { gte: debut, lte: fin }, type: "PRODUIT_FINI" }, _sum: { valeur: true } }),
    (prisma as any).charge.findMany({ where: { companyId, date: { gte: debut, lte: fin } }, include: { categorie: { select: { nom: true, icone: true, couleur: true } } } }),
  ]);

  const ca           = ventes._sum.montantTotal ?? 0;
  const totalPertes  = (pertesMP._sum.valeur ?? 0) + (pertesPF._sum.valeur ?? 0);
  const margeBrute   = ca - totalPertes;
  const totalCharges = charges.reduce((s: number, c: any) => s + c.montant, 0);
  const resultatNet  = margeBrute - totalCharges;

  // Grouper charges par catégorie
  const parCat: Record<string, any> = {};
  for (const ch of charges) {
    if (!parCat[ch.categorieId]) parCat[ch.categorieId] = { ...ch.categorie, total: 0, count: 0 };
    parCat[ch.categorieId].total += ch.montant;
    parCat[ch.categorieId].count++;
  }

  res.json({
    success: true,
    data: {
      periode: { debut, fin },
      ca, nbVentes: ventes._count,
      totalPertes, pertesMP: pertesMP._sum.valeur ?? 0, pertesPF: pertesPF._sum.valeur ?? 0,
      margeBrute, margeBrutePct: ca > 0 ? Math.round(margeBrute / ca * 100) : 0,
      totalCharges,
      chargesParCat: Object.values(parCat).sort((a: any, b: any) => b.total - a.total),
      resultatNet, resultatNetPct: ca > 0 ? Math.round(resultatNet / ca * 100) : 0,
    },
  });
});

export default router;
