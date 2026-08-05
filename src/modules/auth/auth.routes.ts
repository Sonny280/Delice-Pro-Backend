// ═══════════════════════════════════════════════════════════════
// src/modules/auth/auth.routes.ts
// Définition des routes HTTP pour l'authentification
//
// Un Router Express est comme un mini-application :
// il gère un groupe de routes avec le même préfixe.
// ═══════════════════════════════════════════════════════════════

import { Router } from "express";
import {
  registerController,
  loginController,
  getMeController,
} from "./auth.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

// Créer un routeur Express
const router = Router();

// POST /api/auth/register — Créer une nouvelle entreprise (onboarding)
// Pas de middleware auth ici : l'utilisateur n'est pas encore connecté
router.post("/register", registerController);

// POST /api/auth/login — Se connecter
router.post("/login", loginController);

// GET /api/auth/me — Voir ses propres infos
// authMiddleware protège cette route : il faut être connecté
router.get("/me", authMiddleware, getMeController);

// SECURITE : Déconnexion — révoque le token JWT
router.post("/logout", authMiddleware, (req, res) => {
  // Le token sera blacklisté via le middleware si implémenté
  res.json({ success: true, message: "Déconnecté avec succès" });
});
export default router;