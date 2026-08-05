// ═══════════════════════════════════════════════════════════════
// src/modules/matieresPremières/mp.controller.ts + mp.routes.ts
// ═══════════════════════════════════════════════════════════════

import { Request, Response } from "express";
import { Router } from "express";
import {
  getMPList,
  createMP,
  updateMP,
  deleteMP,
  entreeStock,

  getMouvementsStock,
  createMPSchema,
  updateMPSchema,
  entreeStockSchema,
} from "./mp.service";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";

// ─── CONTROLLER ──────────────────────────────────────────────────

// GET /api/mp — Lister toutes les MP
export async function listMPController(req: Request, res: Response) {
  const mps = await getMPList(req.user!.companyId);
  res.json({ success: true, data: mps });
}

// POST /api/mp — Créer une MP
export async function createMPController(req: Request, res: Response) {
  const data = createMPSchema.parse(req.body);
  const mp = await createMP(req.user!.companyId, data);
  res.status(201).json({ success: true, data: mp });
}

// PUT /api/mp/:id — Modifier une MP
export async function updateMPController(req: Request, res: Response) {
  const data = updateMPSchema.parse(req.body);
  const mp = await updateMP(req.params.id, req.user!.companyId, data);
  res.json({ success: true, data: mp });
}

// DELETE /api/mp/:id — Désactiver une MP
export async function deleteMPController(req: Request, res: Response) {
  await deleteMP(req.params.id, req.user!.companyId);
  res.json({ success: true, message: "Matière première désactivée" });
}

// POST /api/mp/entree — Entrée de stock
export async function entreeStockController(req: Request, res: Response) {
  const data = entreeStockSchema.parse(req.body);
  const mp = await entreeStock(req.user!.companyId, data);
  res.json({ success: true, data: mp });
}

// GET /api/mp/:id/mouvements — Historique mouvements
export async function mouvementsController(req: Request, res: Response) {
  const mouvements = await getMouvementsStock(req.params.id, req.user!.companyId);
  res.json({ success: true, data: mouvements });
}

// ─── ROUTES ──────────────────────────────────────────────────────
const router = Router();

// Toutes les routes MP nécessitent d'être connecté
router.use(authMiddleware);

router.get("/", listMPController);
router.post(
  "/",
  requireRole(["ADMIN", "RESPONSABLE", "GESTIONNAIRE", "CHEF_PATISSIER"]),
  createMPController
);
router.put(
  "/:id",
  requireRole(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]),
  updateMPController
);
router.delete(
  "/:id",
  requireRole(["ADMIN"]),
  deleteMPController
);
router.post(
  "/entree",
  requireRole(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]),
  entreeStockController
);
router.get("/:id/mouvements", mouvementsController);

export default router;
