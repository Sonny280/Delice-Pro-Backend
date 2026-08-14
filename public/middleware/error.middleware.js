"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = exports.AppError = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
// Classe d'erreur personnalisée pour nos erreurs métier
// Permet de définir un status HTTP spécifique
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true // erreur prévue vs bug inattendu
    ) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.name = "AppError";
        // Capturer la stack trace pour le debugging
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
// Le middleware d'erreur Express a OBLIGATOIREMENT 4 paramètres
// (err, req, res, next) — Express le reconnaît grâce à ça
const errorMiddleware = (err, req, res, next // Requis même si non utilisé (signature Express)
) => {
    // Log de l'erreur dans la console pour le debugging
    console.error(`[ERROR] ${new Date().toISOString()} - ${err.message}`);
    // ─── Erreur de validation Zod ───
    // Se produit quand les données envoyées par le client ne correspondent
    // pas au schéma de validation (ex: email manquant, prix négatif)
    if (err instanceof zod_1.ZodError) {
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
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
            // P2002 = contrainte d'unicité violée
            res.status(409).json({
                success: false,
                message: "Cette valeur existe déjà (contrainte d'unicité)",
            });
            return;
        }
        if (err.code === "P2025") {
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
exports.errorMiddleware = errorMiddleware;
//# sourceMappingURL=error.middleware.js.map