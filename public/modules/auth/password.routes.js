"use strict";
// src/modules/auth/password.routes.ts
// ─────────────────────────────────────────────────────────────────────────────
// ROUTES : Mot de passe oublié + Double Authentification (2FA)
//
// POST /api/auth/forgot-password   → Envoyer email de reset
// POST /api/auth/reset-password    → Changer le mot de passe avec le token
// POST /api/auth/2fa/send          → Envoyer le code 2FA par email
// POST /api/auth/2fa/verify        → Vérifier le code 2FA
// POST /api/auth/2fa/toggle        → Activer/désactiver la 2FA
// ─────────────────────────────────────────────────────────────────────────────
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const database_1 = __importDefault(require("../../config/database"));
const auth_middleware_1 = require("../../middleware/auth.middleware");
const email_service_1 = require("../../services/email.service");
const auth_service_1 = require("../auth/auth.service");
const router = (0, express_1.Router)();
// ── POST /api/auth/forgot-password ───────────────────────────────────────────
// Étape 1 du reset : l'utilisateur donne son email
// → On génère un token unique et on envoie un email avec le lien
router.post("/forgot-password", async (req, res) => {
    const { email } = zod_1.z.object({
        email: zod_1.z.string().email("Email invalide"),
    }).parse(req.body);
    // Trouver l'utilisateur (on ne révèle pas si l'email existe ou non)
    const user = await database_1.default.user.findFirst({
        where: { email: email.toLowerCase(), actif: true },
    });
    // SECURITE : Toujours répondre la même chose (anti-énumération d'emails)
    const messageGenerique = "Si cet email existe, un lien de réinitialisation a été envoyé.";
    if (!user) {
        res.json({ success: true, message: messageGenerique });
        return;
    }
    // Générer un token unique (UUID) et le sauvegarder
    const token = crypto_1.default.randomUUID();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // +1 heure
    await database_1.default.user.update({
        where: { id: user.id },
        data: {
            resetToken: token,
            resetTokenExpiry: expiry,
        },
    });
    // Envoyer l'email
    await (0, email_service_1.envoyerEmailReset)(user.email, user.prenom, token);
    res.json({ success: true, message: messageGenerique });
});
// ── POST /api/auth/reset-password ────────────────────────────────────────────
// Étape 2 du reset : l'utilisateur clique le lien et saisit son nouveau MDP
router.post("/reset-password", async (req, res) => {
    const { token, newPassword } = zod_1.z.object({
        token: zod_1.z.string().min(1, "Token manquant"),
        newPassword: zod_1.z.string()
            .min(8, "Le mot de passe doit contenir au moins 8 caractères")
            .regex(/\d/, "Le mot de passe doit contenir au moins un chiffre")
            .regex(/[a-zA-Z]/, "Le mot de passe doit contenir au moins une lettre"),
    }).parse(req.body);
    // Vérifier le token
    const user = await database_1.default.user.findFirst({
        where: {
            resetToken: token,
            actif: true,
        },
    });
    if (!user) {
        res.status(400).json({
            success: false,
            message: "Lien invalide ou déjà utilisé. Faites une nouvelle demande.",
        });
        return;
    }
    // Vérifier l'expiration (1 heure)
    const expiry = user.resetTokenExpiry;
    if (!expiry || new Date() > expiry) {
        res.status(400).json({
            success: false,
            message: "Ce lien a expiré (valable 1 heure). Faites une nouvelle demande.",
        });
        return;
    }
    // Changer le mot de passe et invalider le token
    const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
    await database_1.default.user.update({
        where: { id: user.id },
        data: {
            passwordHash,
            resetToken: null, // Invalider le token
            resetTokenExpiry: null,
        },
    });
    res.json({
        success: true,
        message: "Mot de passe modifié avec succès. Vous pouvez vous connecter.",
    });
});
// ── POST /api/auth/2fa/send ───────────────────────────────────────────────────
// Envoyer le code 2FA par email (appelé après vérification email+MDP)
router.post("/2fa/send", async (req, res) => {
    const { email } = zod_1.z.object({
        email: zod_1.z.string().email(),
    }).parse(req.body);
    const user = await database_1.default.user.findFirst({
        where: { email: email.toLowerCase(), actif: true },
    });
    if (!user) {
        // SECURITE : Même réponse si l'utilisateur n'existe pas
        res.json({ success: true, message: "Code envoyé si le compte existe." });
        return;
    }
    // Générer un code à 6 chiffres
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // +10 minutes
    // Sauvegarder le code en base
    await database_1.default.user.update({
        where: { id: user.id },
        data: {
            twoFactorCode: code,
            twoFactorExpiry: expiry,
        },
    });
    // Envoyer par email
    await (0, email_service_1.envoyerEmailCode2FA)(user.email, user.prenom, code);
    res.json({ success: true, message: "Code envoyé par email. Valable 10 minutes." });
});
// ── POST /api/auth/2fa/verify ─────────────────────────────────────────────────
// Vérifier le code 2FA et retourner le token JWT si correct
router.post("/2fa/verify", async (req, res) => {
    const { email, code } = zod_1.z.object({
        email: zod_1.z.string().email(),
        code: zod_1.z.string().length(6, "Le code doit être à 6 chiffres"),
    }).parse(req.body);
    const user = await database_1.default.user.findFirst({
        where: {
            email: email.toLowerCase(),
            twoFactorCode: code,
            actif: true,
        },
        include: { company: true },
    });
    if (!user) {
        res.status(401).json({
            success: false,
            message: "Code incorrect. Vérifiez le code reçu par email.",
        });
        return;
    }
    // Vérifier l'expiration (10 minutes)
    const expiry = user.twoFactorExpiry;
    if (!expiry || new Date() > expiry) {
        res.status(401).json({
            success: false,
            message: "Ce code a expiré (valable 10 minutes). Redemandez un nouveau code.",
        });
        return;
    }
    // Code correct → invalider et retourner le token JWT
    await database_1.default.user.update({
        where: { id: user.id },
        data: {
            twoFactorCode: null,
            twoFactorExpiry: null,
        },
    });
    const token = (0, auth_service_1.generateToken)(user.id, user.companyId, user.role, user.email);
    res.json({
        success: true,
        data: {
            token,
            user: {
                id: user.id,
                prenom: user.prenom,
                nom: user.nom,
                email: user.email,
                role: user.role,
            },
            company: user.company,
        },
    });
});
// ── POST /api/auth/2fa/toggle ─────────────────────────────────────────────────
// Activer ou désactiver la 2FA pour son compte (nécessite d'être connecté)
router.post("/2fa/toggle", auth_middleware_1.authMiddleware, async (req, res) => {
    const { activer } = zod_1.z.object({
        activer: zod_1.z.boolean(),
    }).parse(req.body);
    await database_1.default.user.update({
        where: { id: req.user.id },
        data: { twoFactorEnabled: activer },
    });
    res.json({
        success: true,
        message: activer
            ? "Double authentification activée. Un code vous sera demandé à chaque connexion."
            : "Double authentification désactivée.",
    });
});
exports.default = router;
//# sourceMappingURL=password.routes.js.map