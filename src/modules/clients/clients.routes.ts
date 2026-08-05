// src/modules/clients/clients.routes.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import prisma from "../../config/database";

const router = Router();
router.use(authMiddleware);

const clientSchema = z.object({
  nom: z.string().min(2),
  type: z.enum(["PARTICULIER", "PROFESSIONNEL"]).default("PARTICULIER"),
  telephone: z.string().optional(),
  email: z.string().optional(),
  adresse: z.string().optional(),
  entreprise: z.string().optional(),
  notes: z.string().optional(),
});

router.get("/", async (req: Request, res: Response) => {
  const clients = await prisma.client.findMany({
    where: { companyId: req.user!.companyId, actif: true },
    include: { _count: { select: { commandes: true } } },
    orderBy: { nom: "asc" },
  });
  res.json({ success: true, data: clients });
});

router.post("/", async (req: Request, res: Response) => {
  const data = clientSchema.parse(req.body);
  const client = await prisma.client.create({
    data: { ...data, companyId: req.user!.companyId },
  });
  res.status(201).json({ success: true, data: client });
});

router.put("/:id", async (req: Request, res: Response) => {
  const data = clientSchema.partial().parse(req.body);
  const client = await prisma.client.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: client });
});

router.delete("/:id", requireRole(["ADMIN"]), async (req: Request, res: Response) => {
  await prisma.client.update({ where: { id: req.params.id }, data: { actif: false } });
  res.json({ success: true });
});

export default router;