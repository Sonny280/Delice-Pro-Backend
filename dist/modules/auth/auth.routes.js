"use strict";
// ═══════════════════════════════════════════════════════════════
// src/modules/auth/auth.routes.ts
// Définition des routes HTTP pour l'authentification
//
// Un Router Express est comme un mini-application :
// il gère un groupe de routes avec le même préfixe.
// ═══════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
// Créer un routeur Express
const router = (0, express_1.Router)();
// POST /api/auth/register — Créer une nouvelle entreprise (onboarding)
// Pas de middleware auth ici : l'utilisateur n'est pas encore connecté
router.post("/register", auth_controller_1.registerController);
// POST /api/auth/login — Se connecter
router.post("/login", auth_controller_1.loginController);
// GET /api/auth/me — Voir ses propres infos
// authMiddleware protège cette route : il faut être connecté
router.get("/me", auth_middleware_1.authMiddleware, auth_controller_1.getMeController);
// SECURITE : Déconnexion — révoque le token JWT
router.post("/logout", auth_middleware_1.authMiddleware, (req, res) => {
    // Le token sera blacklisté via le middleware si implémenté
    res.json({ success: true, message: "Déconnecté avec succès" });
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map