// src/modules/company/company.routes.ts
import { Router, Request, Response } from "express";
import multer from "multer";
import prisma from "../../config/database";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import {
  getCompany,
  updateCompany,
  uploadLogo,
  getDashboardData,
  updateCompanySchema,
} from "./company.service";

const router = Router();

// ── Route PUBLIQUE (avant authMiddleware) ────────────────────────
// Liste des boulangeries pour la page de login
// Pas d'authentification requise
router.get("/list-public", async (_req: Request, res: Response) => {
  const companies = await prisma.company.findMany({
    select:  { id: true, nom: true, ville: true },
    orderBy: { nom: "asc" },
  });
  res.json({ success: true, data: companies });
});

// ── Routes PRIVÉES (avec authMiddleware) ─────────────────────────
router.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Seules les images sont acceptées (PNG, JPG, SVG, WebP)"));
    }
  },
});

// GET /api/company
router.get("/", async (req: Request, res: Response) => {
  const company = await getCompany(req.user!.companyId);
  res.json({ success: true, data: company });
});

// PUT /api/company
router.put("/", requireRole(["ADMIN"]), async (req: Request, res: Response) => {
  const data = updateCompanySchema.parse(req.body);
  const company = await updateCompany(req.user!.companyId, data);
  res.json({ success: true, data: company });
});

// POST /api/company/logo
router.post(
  "/logo",
  requireRole(["ADMIN"]),
  (req: Request, res: Response, next: any) => {
    upload.single("logo")(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          success: false,
          message: "Logo trop lourd. Maximum 500 Ko. Compressez sur https://squoosh.app/",
        });
        return;
      }
      if (err) {
        res.status(400).json({ success: false, message: err.message });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: "Aucun fichier reçu" });
      return;
    }
    const logoUrl = await uploadLogo(
      req.user!.companyId,
      req.file.buffer,
      req.file.mimetype
    );
    res.json({ success: true, data: { logoUrl } });
  }
);

// GET /api/company/dashboard
router.get("/dashboard", async (req: Request, res: Response) => {
  const data = await getDashboardData(req.user!.companyId);
  res.json({ success: true, data });
});

export default router;
