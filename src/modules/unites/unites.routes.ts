// src/modules/unites/unites.routes.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import prisma from "../../config/database";

const router = Router();
router.use(authMiddleware);

const uniteSchema = z.object({
  nom: z.string().min(2),
  abreviation: z.string().min(1),
  type: z.enum(["MASSE", "VOLUME", "COMPTAGE", "CONDITIONNEMENT"]),
  uniteBase: z.string(),
  coefficient: z.number().positive("Le coefficient doit être positif"),
});

router.get("/", async (req: Request, res: Response) => {
  const unites = await prisma.unite.findMany({
    where: { companyId: req.user!.companyId },
    orderBy: { nom: "asc" },
  });
  res.json({ success: true, data: unites });
});

router.post(
  "/",
  requireRole(["ADMIN", "RESPONSABLE"]),
  async (req: Request, res: Response) => {
    const data = uniteSchema.parse(req.body);
    const unite = await prisma.unite.create({
      data: { ...data, companyId: req.user!.companyId },
    });
    res.status(201).json({ success: true, data: unite });
  }
);

router.put(
  "/:id",
  requireRole(["ADMIN"]),
  async (req: Request, res: Response) => {
    const data = uniteSchema.partial().parse(req.body);
    const unite = await prisma.unite.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: unite });
  }
);

export default router;
