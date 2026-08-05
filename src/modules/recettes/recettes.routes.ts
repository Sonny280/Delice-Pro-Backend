// src/modules/recettes/recettes.routes.ts
import { Router, Request, Response } from "express";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import {
  getRecettes, createRecette, updateRecette,
  dupliquerRecette, archiverRecette,
  createRecetteSchema, updateRecetteSchema,
} from "./recettes.service";

const router = Router();
router.use(authMiddleware);

// GET /api/recettes
router.get("/", async (req: Request, res: Response) => {
  const recettes = await getRecettes(req.user!.companyId);
  res.json({ success: true, data: recettes });
});

// POST /api/recettes
router.post("/", requireRole(["ADMIN", "RESPONSABLE", "CHEF_PATISSIER"]), async (req: Request, res: Response) => {
  const data    = createRecetteSchema.parse(req.body);
  const recette = await createRecette(req.user!.companyId, data);
  res.status(201).json({ success: true, data: recette });
});

// PUT /api/recettes/:id
router.put("/:id", requireRole(["ADMIN", "RESPONSABLE", "CHEF_PATISSIER"]), async (req: Request, res: Response) => {
  const data    = updateRecetteSchema.parse(req.body);
  const recette = await updateRecette(req.params.id, req.user!.companyId, data);
  res.json({ success: true, data: recette });
});

// POST /api/recettes/:id/dupliquer
router.post("/:id/dupliquer", requireRole(["ADMIN", "RESPONSABLE", "CHEF_PATISSIER"]), async (req: Request, res: Response) => {
  const copie = await dupliquerRecette(req.params.id, req.user!.companyId);
  res.status(201).json({ success: true, data: copie });
});

// DELETE /api/recettes/:id  (archivage soft)
router.delete("/:id", requireRole(["ADMIN", "RESPONSABLE"]), async (req: Request, res: Response) => {
  await archiverRecette(req.params.id, req.user!.companyId);
  res.json({ success: true, message: "Recette archivee" });
});

export default router;