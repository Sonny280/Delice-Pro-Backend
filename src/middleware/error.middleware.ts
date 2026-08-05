// ═══════════════════════════════════════════════════════════════
// src/middleware/error.middleware.ts
// Gestion centralisée des erreurs Express
//
// Sans ce middleware, chaque controller devrait gérer ses erreurs
// individuellement. Avec lui, on attrape TOUTES les erreurs non
// gérées et on renvoie une réponse JSON cohérente.
//
// Il doit être enregistré EN DERNIER dans app.ts (après toutes les routes)
// ═══════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

// Classe d'erreur personnalisée pour nos erreurs métier
// Permet de définir un status HTTP spécifique
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true // erreur prévue vs bug inattendu
  ) {
    super(message);
    this.name = "AppError";
    // Capturer la stack trace pour le debugging
    Error.captureStackTrace(this, this.constructor);
  }
}

// Le middleware d'erreur Express a OBLIGATOIREMENT 4 paramètres
// (err, req, res, next) — Express le reconnaît grâce à ça
export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction // Requis même si non utilisé (signature Express)
): void => {
  // Log de l'erreur dans la console pour le debugging
  console.error(`[ERROR] ${new Date().toISOString()} - ${err.message}`);

  // ─── Erreur de validation Zod ───
  // Se produit quand les données envoyées par le client ne correspondent
  // pas au schéma de validation (ex: email manquant, prix négatif)
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Données invalides",
      // Formater les erreurs Zod pour qu'elles soient lisibles
      errors: err.errors.map((e) => ({
        field: e.path.join("."), // Ex: "email" ou "produit.prix"
        message: e.message,
      })),
    });
    return;
  }

  // ─── Erreurs Prisma ───
  // Erreur d'unicité (ex: email déjà utilisé)
  if (err instanceof (Prisma as any).PrismaClientKnownRequestError) {
    if ((err as any).code === "P2002") {
      // P2002 = contrainte d'unicité violée
      res.status(409).json({
        success: false,
        message: "Cette valeur existe déjà (contrainte d'unicité)",
      });
      return;
    }
    if ((err as any).code === "P2025") {
      // P2025 = enregistrement non trouvé
      res.status(404).json({
        success: false,
        message: "Enregistrement introuvable",
      });
      return;
    }
  }

  // ─── Erreur applicative prévue (AppError) ───
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // ─── Erreur inattendue (bug) ───
  // Ne pas exposer les détails en production (risque de sécurité)
  const isDev = process.env.NODE_ENV === "development";
  res.status(500).json({
    success: false,
    message: "Erreur interne du serveur",
    // En développement, afficher les détails pour déboguer
    ...(isDev && { stack: err.stack, detail: err.message }),
  });
};