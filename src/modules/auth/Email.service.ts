// src/services/email.service.ts
import { Resend } from "resend";

const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = process.env.EMAIL_FROM    || "noreply@delice-pro.ci";
const APP_URL = process.env.FRONTEND_URL  || "http://localhost:5173";

// ── Template HTML ─────────────────────────────────────────────────────────────
const template = (titre: string, contenu: string) => `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${titre}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
        style="background:white;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.1)">
        <tr><td style="background:#1A2744;padding:30px;text-align:center">
          <div style="font-size:32px">🍞</div>
          <h1 style="color:white;margin:8px 0 0;font-size:22px">Délice Pro</h1>
        </td></tr>
        <tr><td style="padding:40px">${contenu}</td></tr>
        <tr><td style="background:#f8f9fa;padding:20px;text-align:center;border-top:1px solid #eee">
          <p style="color:#888;font-size:12px;margin:0">Email automatique Délice Pro — Ne pas répondre</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

// ── 1. Réinitialisation mot de passe ─────────────────────────────────────────
export const envoyerEmailReset = async (
  email: string, prenom: string, token: string
): Promise<boolean> => {
  const lien = `${APP_URL}/reset-password?token=${token}`;
  try {
    await resend.emails.send({
      from: FROM, to: email,
      subject: "🔑 Réinitialisation de votre mot de passe — Délice Pro",
      html: template("Reset MDP", `
        <h2 style="color:#1A2744;margin-top:0">Réinitialisation du mot de passe</h2>
        <p style="color:#555">Bonjour <strong>${prenom}</strong>,</p>
        <p style="color:#555">Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe :</p>
        <div style="text-align:center;margin:30px 0">
          <a href="${lien}" style="background:#1A2744;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
            🔑 Réinitialiser mon mot de passe
          </a>
        </div>
        <p style="color:#f59e0b;font-size:13px">⏰ Ce lien expire dans <strong>1 heure</strong>.</p>
        <p style="color:#888;font-size:12px;word-break:break-all">Ou copiez : ${lien}</p>
      `),
    });
    return true;
  } catch (e) { console.error("[EMAIL] Reset:", e); return false; }
};

// ── 2. Code 2FA ───────────────────────────────────────────────────────────────
export const envoyerEmailCode2FA = async (
  email: string, prenom: string, code: string
): Promise<boolean> => {
  try {
    await resend.emails.send({
      from: FROM, to: email,
      subject: `🔐 Code de connexion Délice Pro : ${code}`,
      html: template("Code 2FA", `
        <h2 style="color:#1A2744;margin-top:0">Code de vérification</h2>
        <p style="color:#555">Bonjour <strong>${prenom}</strong>, voici votre code :</p>
        <div style="text-align:center;margin:30px 0">
          <div style="background:#f0f4ff;border:2px solid #1A2744;border-radius:12px;
                      padding:24px;display:inline-block">
            <div style="font-size:48px;font-weight:bold;color:#1A2744;letter-spacing:12px;font-family:monospace">
              ${code}
            </div>
          </div>
        </div>
        <p style="color:#f59e0b;font-size:13px">⏰ Ce code expire dans <strong>10 minutes</strong>.</p>
        <p style="color:#888;font-size:13px">Ne partagez jamais ce code.</p>
      `),
    });
    return true;
  } catch (e) { console.error("[EMAIL] 2FA:", e); return false; }
};

// ── 3. Bienvenue ──────────────────────────────────────────────────────────────
export const envoyerEmailBienvenue = async (
  email: string, prenom: string, entreprise: string, motDePasse: string
): Promise<boolean> => {
  try {
    await resend.emails.send({
      from: FROM, to: email,
      subject: `🍞 Bienvenue sur Délice Pro — ${entreprise}`,
      html: template("Bienvenue", `
        <h2 style="color:#1A2744;margin-top:0">Bienvenue sur Délice Pro !</h2>
        <p style="color:#555">Bonjour <strong>${prenom}</strong>, votre compte a été créé.</p>
        <div style="background:#f0f9ff;border:1px solid #1A2744;border-radius:8px;padding:20px;margin:20px 0">
          <p style="color:#1A2744;margin:0 0 8px;font-weight:bold">Vos identifiants :</p>
          <p style="color:#555;margin:4px 0">📧 Email : <strong>${email}</strong></p>
          <p style="color:#555;margin:4px 0">🔑 Mot de passe : <strong>${motDePasse}</strong></p>
        </div>
        <p style="color:#f59e0b;font-size:13px">⚠️ Changez votre mot de passe à la première connexion.</p>
        <div style="text-align:center;margin:30px 0">
          <a href="${APP_URL}" style="background:#1A2744;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold">
            🚀 Accéder à Délice Pro
          </a>
        </div>
      `),
    });
    return true;
  } catch (e) { console.error("[EMAIL] Bienvenue:", e); return false; }
};
