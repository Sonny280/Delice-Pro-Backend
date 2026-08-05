// src/modules/marges/marges.routes.ts
import { Router, Request, Response } from "express";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import { getMargesTousProduits, getMargesParCategorie, simulerImpactHausse } from "./marges.service";

const router = Router();
router.use(authMiddleware);

// GET /api/marges
router.get("/",
  requireRole(["ADMIN", "RESPONSABLE", "GESTIONNAIRE", "COMPTABLE", "CHEF_PATISSIER"]),
  async (req: Request, res: Response) => {
    const result = await getMargesTousProduits(req.user!.companyId);
    res.json({ success: true, data: result });
  }
);

// GET /api/marges/categories
router.get("/categories",
  requireRole(["ADMIN", "RESPONSABLE", "GESTIONNAIRE", "COMPTABLE"]),
  async (req: Request, res: Response) => {
    const result = await getMargesParCategorie(req.user!.companyId);
    res.json({ success: true, data: result });
  }
);

// POST /api/marges/simuler
// Body: { variations: [{ mpId, variation }] }
router.post("/simuler",
  requireRole(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]),
  async (req: Request, res: Response) => {
    const { variations } = req.body;
    if (!Array.isArray(variations)) {
      res.status(400).json({ success: false, message: "variations[] requis" });
      return;
    }
    const result = await simulerImpactHausse(req.user!.companyId, variations);
    res.json({ success: true, data: result });
  }
);

export default router;