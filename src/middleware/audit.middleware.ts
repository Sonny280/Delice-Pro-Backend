// src/middleware/audit.middleware.ts
// SECURITE : Middleware pour enregistrer les actions sensibles dans l'audit log

import { Request, Response, NextFunction } from "express";
import prisma from "../config/database";

// Actions à auditer automatiquement
const ACTIONS_AUDITEES: Record<string, string> = {
  "POST /api/auth/login":            "CONNEXION",
  "POST /api/auth/logout":           "DECONNEXION",
  "POST /api/ventes":                "VENTE_CREEE",
  "PUT /api/ventes":                 "VENTE_MODIFIEE",
  "DELETE /api/ventes":              "VENTE_ANNULEE",
  "POST /api/production/enregistrer":"PRODUCTION_CREEE",
  "POST /api/pertes":                "PERTE_DECLAREE",
  "DELETE /api/pertes":              "PERTE_SUPPRIMEE",
  "POST /api/cloture/journee":       "CLOTURE_JOURNEE",
  "PUT /api/users":                  "UTILISATEUR_MODIFIE",
  "DELETE /api/users":               "UTILISATEUR_SUPPRIME",
};

export const auditMiddleware = async (
  req: Request, res: Response, next: NextFunction
) => {
  // Capturer la réponse pour logger seulement les succès
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    // Logger si action sensible et réponse réussie
    const cle = `${req.method} ${req.path}`;
    const action = ACTIONS_AUDITEES[cle];
    const userId    = req.user?.id;
    const companyId = req.user?.companyId;

    if (action && companyId && body?.success !== false) {
      
      // Log asynchrone — ne bloque pas la réponse
      prisma.auditLog.create({
        data: {
          action,
          entite:   req.path.split("/")[2] ?? undefined,
          entiteId: body?.data?.id ?? req.params.id ?? undefined,
          details:  JSON.stringify({ method: req.method, path: req.path }).substring(0, 500),
          ip:       req.ip ?? undefined,
          userId:   userId ?? undefined,
          companyId,
        },
      } as any).catch(() => {}); // Silencieux si échec
    }

    return originalJson(body);
  };
  next();
};
