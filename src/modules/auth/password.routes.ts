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

import { Router, Request, Response } from "express";
import { z }                         from "zod";
import bcrypt                        from "bcryptjs";
import crypto                        from "crypto";
import prisma                        from "../../config/database";
import { authMiddleware }            from "../../middleware/auth.middleware";
import {
  envoyerEmailReset,
  envoyerEmailCode2FA,
} from "../../services/email.service";
import { generateToken } from "../auth/auth.service";

const router = Router();

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
// Étape 1 du reset : l'utilisateur donne son email
// → On génère un token unique et on envoie un email avec le lien
router.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = z.object({
    email: z.string().email("Email invalide"),
  }).parse(req.body);

  // Trouver l'utilisateur (on ne révèle pas si l'email existe ou non)
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), actif: true },
  });

  // SECURITE : Toujours répondre la même chose (anti-énumération d'emails)
  const messageGenerique = "Si cet email existe, un lien de réinitialisation a été envoyé.";

  if (!user) {
    res.json({ success: true, message: messageGenerique });
    return;
  }

  // Générer un token unique (UUID) et le sauvegarder
  const token  = crypto.randomUUID();
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // +1 heure

  await prisma.user.update({
    where: { id: user.id },
    data:  {
      resetToken:       token,
      resetTokenExpiry: expiry,
    } as any,
  });

  // Envoyer l'email
  await envoyerEmailReset(user.email, user.prenom, token);

  res.json({ success: true, message: messageGenerique });
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
// Étape 2 du reset : l'utilisateur clique le lien et saisit son nouveau MDP
router.post("/reset-password", async (req: Request, res: Response) => {
  const { token, newPassword } = z.object({
    token:       z.string().min(1, "Token manquant"),
    newPassword: z.string()
      .min(8,  "Le mot de passe doit contenir au moins 8 caractères")
      .regex(/\d/, "Le mot de passe doit contenir au moins un chiffre")
      .regex(/[a-zA-Z]/, "Le mot de passe doit contenir au moins une lettre"),
  }).parse(req.body);

  // Vérifier le token
  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      actif:      true,
    } as any,
  });

  if (!user) {
    res.status(400).json({
      success: false,
      message: "Lien invalide ou déjà utilisé. Faites une nouvelle demande.",
    });
    return;
  }

  // Vérifier l'expiration (1 heure)
  const expiry = (user as any).resetTokenExpiry as Date | null;
  if (!expiry || new Date() > expiry) {
    res.status(400).json({
      success: false,
      message: "Ce lien a expiré (valable 1 heure). Faites une nouvelle demande.",
    });
    return;
  }

  // Changer le mot de passe et invalider le token
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data:  {
      passwordHash,
      resetToken:       null, // Invalider le token
      resetTokenExpiry: null,
    } as any,
  });

  res.json({
    success: true,
    message: "Mot de passe modifié avec succès. Vous pouvez vous connecter.",
  });
});

// ── POST /api/auth/2fa/send ───────────────────────────────────────────────────
// Envoyer le code 2FA par email (appelé après vérification email+MDP)
router.post("/2fa/send", async (req: Request, res: Response) => {
  const { email } = z.object({
    email: z.string().email(),
  }).parse(req.body);

  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), actif: true },
  });

  if (!user) {
    // SECURITE : Même réponse si l'utilisateur n'existe pas
    res.json({ success: true, message: "Code envoyé si le compte existe." });
    return;
  }

  // Générer un code à 6 chiffres
  const code   = String(Math.floor(100000 + Math.random() * 900000));
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // +10 minutes

  // Sauvegarder le code en base
  await prisma.user.update({
    where: { id: user.id },
    data:  {
      twoFactorCode:   code,
      twoFactorExpiry: expiry,
    } as any,
  });

  // Envoyer par email
  await envoyerEmailCode2FA(user.email, user.prenom, code);

  res.json({ success: true, message: "Code envoyé par email. Valable 10 minutes." });
});

// ── POST /api/auth/2fa/verify ─────────────────────────────────────────────────
// Vérifier le code 2FA et retourner le token JWT si correct
router.post("/2fa/verify", async (req: Request, res: Response) => {
  const { email, code } = z.object({
    email: z.string().email(),
    code:  z.string().length(6, "Le code doit être à 6 chiffres"),
  }).parse(req.body);

  const user = await prisma.user.findFirst({
    where: {
      email:           email.toLowerCase(),
      twoFactorCode:   code,
      actif:           true,
    } as any,
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
  const expiry = (user as any).twoFactorExpiry as Date | null;
  if (!expiry || new Date() > expiry) {
    res.status(401).json({
      success: false,
      message: "Ce code a expiré (valable 10 minutes). Redemandez un nouveau code.",
    });
    return;
  }

  // Code correct → invalider et retourner le token JWT
  await prisma.user.update({
    where: { id: user.id },
    data:  {
      twoFactorCode:   null,
      twoFactorExpiry: null,
    } as any,
  });

  const token = generateToken(user.id, user.companyId, user.role, user.email);

  res.json({
    success: true,
    data: {
      token,
      user: {
        id:     user.id,
        prenom: user.prenom,
        nom:    user.nom,
        email:  user.email,
        role:   user.role,
      },
      company: user.company,
    },
  });
});

// ── POST /api/auth/2fa/toggle ─────────────────────────────────────────────────
// Activer ou désactiver la 2FA pour son compte (nécessite d'être connecté)
router.post("/2fa/toggle", authMiddleware, async (req: Request, res: Response) => {
  const { activer } = z.object({
    activer: z.boolean(),
  }).parse(req.body);

  await prisma.user.update({
    where: { id: req.user!.id },
    data:  { twoFactorEnabled: activer } as any,
  });

  res.json({
    success: true,
    message: activer
      ? "Double authentification activée. Un code vous sera demandé à chaque connexion."
      : "Double authentification désactivée.",
  });
});

export default router;