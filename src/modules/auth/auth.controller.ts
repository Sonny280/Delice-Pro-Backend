// ═══════════════════════════════════════════════════════════════
// src/modules/auth/auth.controller.ts
// Contrôleur HTTP pour l'authentification
//
// Le controller est la couche HTTP : il reçoit la requête HTTP,
// appelle le service, et renvoie la réponse JSON.
// Il ne contient PAS de logique métier (c'est le rôle du service).
// ═══════════════════════════════════════════════════════════════

import { Request, Response } from "express";
import {
  registerCompany,
  registerCompanySchema,
  login,
  loginSchema,
} from "./auth.service";

// ─── POST /api/auth/register ────────────────────────────────────
// Créer une nouvelle entreprise avec son administrateur (onboarding)
export async function registerController(
  req: Request,
  res: Response
): Promise<void> {
  // 1. Valider les données reçues avec Zod
  // .parse() lance une exception ZodError si les données sont invalides
  // (elle sera attrapée par errorMiddleware)
  const data = registerCompanySchema.parse(req.body);

  // 2. Appeler le service (logique métier)
  const result = await registerCompany(data);

  // 3. Répondre avec 201 Created et les données
  res.status(201).json({
    success: true,
    message: "Entreprise créée avec succès",
    data: result,
  });
}

// ─── POST /api/auth/login ───────────────────────────────────────
// Connecter un utilisateur existant
export async function loginController(
  req: Request,
  res: Response
): Promise<void> {
  // Valider les données
  const data = loginSchema.parse(req.body);

  // Appeler le service
  const result = await login(data);

  // Répondre avec 200 OK
  res.status(200).json({
    success: true,
    message: "Connexion réussie",
    data: result,
  });
}

// ─── GET /api/auth/me ───────────────────────────────────────────
// Récupérer les infos de l'utilisateur connecté (depuis le token)
export async function getMeController(
  req: Request,
  res: Response
): Promise<void> {
  // req.user est rempli par authMiddleware
  // On n'a pas besoin d'appeler la BDD car les infos sont dans le token
  res.status(200).json({
    success: true,
    data: req.user,
  });
}
