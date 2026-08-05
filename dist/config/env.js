"use strict";
// ═══════════════════════════════════════════════════════════════
// src/config/env.ts
// Validation et typage des variables d'environnement
//
// Pourquoi ce fichier ?
// Les variables d'environnement (.env) sont des chaînes de texte
// non typées. Si une variable est manquante, l'app plante de façon
// obscure. Zod nous permet de valider au démarrage que tout est
// bien configuré, avec des messages d'erreur clairs.
// ═══════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod"); // Zod = bibliothèque de validation de schémas
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Définir le schéma attendu pour les variables d'environnement
// z.string() = doit être une chaîne de caractères
// .min(1) = ne peut pas être vide
const envSchema = zod_1.z.object({
    // Port du serveur (converti en nombre avec .transform)
    PORT: zod_1.z
        .string()
        .default("5000")
        .transform((val) => parseInt(val, 10)),
    // URL PostgreSQL
    DATABASE_URL: zod_1.z.string().min(1, "DATABASE_URL est requis"),
    // Clé secrète JWT (doit être longue pour être sécurisée)
    JWT_SECRET: zod_1.z
        .string()
        .min(32, "JWT_SECRET doit faire au moins 32 caractères"),
    // Durée du token JWT (ex: "7d", "24h")
    JWT_EXPIRES_IN: zod_1.z.string().default("7d"),
    // Cloudinary (upload d'images)
    CLOUDINARY_CLOUD_NAME: zod_1.z.string().optional(),
    CLOUDINARY_API_KEY: zod_1.z.string().optional(),
    CLOUDINARY_API_SECRET: zod_1.z.string().optional(),
    // Environnement d'exécution
    NODE_ENV: zod_1.z
        .enum(["development", "production", "test"])
        .default("development"),
    // URL du frontend (pour CORS)
    FRONTEND_URL: zod_1.z.string().default("http://localhost:5173"),
    // Mode de déploiement :
    //   SAAS           = web multi-client cloud, avec abonnement
    //   DESKTOP        = app Electron, licence, base SQLite locale
    //   DESKTOP_RESEAU = app Electron, licence, mais connectée à une base
    //                    PostgreSQL centralisée sur un serveur d'entreprise
    //                    (même client Prisma que SAAS, pas de conversion
    //                    SQLite — voir database.ts)
    DEPLOY_MODE: zod_1.z.enum(["SAAS", "DESKTOP", "DESKTOP_RESEAU"]).default("SAAS"),
});
// Valider les variables d'environnement au démarrage
// process.env contient toutes les variables d'environnement
const result = envSchema.safeParse(process.env);
// Si la validation échoue, afficher les erreurs et stopper l'application
if (!result.success) {
    console.error("❌ Variables d'environnement invalides :", result.error.flatten().fieldErrors);
    // Arrêter le processus avec un code d'erreur (1 = erreur)
    process.exit(1);
}
// Exporter les variables validées et typées
// Maintenant, env.PORT est un number, env.JWT_SECRET est un string, etc.
exports.env = result.data;
//# sourceMappingURL=env.js.map