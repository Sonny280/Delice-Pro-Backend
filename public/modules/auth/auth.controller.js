"use strict";
// ═══════════════════════════════════════════════════════════════
// src/modules/auth/auth.controller.ts
// Contrôleur HTTP pour l'authentification
//
// Le controller est la couche HTTP : il reçoit la requête HTTP,
// appelle le service, et renvoie la réponse JSON.
// Il ne contient PAS de logique métier (c'est le rôle du service).
// ═══════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerController = registerController;
exports.loginController = loginController;
exports.getMeController = getMeController;
const auth_service_1 = require("./auth.service");
// ─── POST /api/auth/register ────────────────────────────────────
// Créer une nouvelle entreprise avec son administrateur (onboarding)
async function registerController(req, res) {
    // 1. Valider les données reçues avec Zod
    // .parse() lance une exception ZodError si les données sont invalides
    // (elle sera attrapée par errorMiddleware)
    const data = auth_service_1.registerCompanySchema.parse(req.body);
    // 2. Appeler le service (logique métier)
    const result = await (0, auth_service_1.registerCompany)(data);
    // 3. Répondre avec 201 Created et les données
    res.status(201).json({
        success: true,
        message: "Entreprise créée avec succès",
        data: result,
    });
}
// ─── POST /api/auth/login ───────────────────────────────────────
// Connecter un utilisateur existant
async function loginController(req, res) {
    // Valider les données
    const data = auth_service_1.loginSchema.parse(req.body);
    // Appeler le service
    const result = await (0, auth_service_1.login)(data);
    // Répondre avec 200 OK
    res.status(200).json({
        success: true,
        message: "Connexion réussie",
        data: result,
    });
}
// ─── GET /api/auth/me ───────────────────────────────────────────
// Récupérer les infos de l'utilisateur connecté (depuis le token)
async function getMeController(req, res) {
    // req.user est rempli par authMiddleware
    // On n'a pas besoin d'appeler la BDD car les infos sont dans le token
    res.status(200).json({
        success: true,
        data: req.user,
    });
}
//# sourceMappingURL=auth.controller.js.map