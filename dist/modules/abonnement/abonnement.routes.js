"use strict";
// ═══════════════════════════════════════════════════════════════
// src/modules/abonnement/abonnement.routes.ts
//
// Gère : statut de l'abonnement, historique de paiements,
// et le webhook qui reçoit la confirmation de paiement
// depuis l'agrégateur (CinetPay, PayDunya, ou autre).
//
// IMPORTANT : la route webhook n'a PAS authMiddleware — elle est
// appelée directement par le serveur de l'agrégateur, pas par un
// utilisateur connecté. La sécurité se fait via la vérification
// de signature (voir vérifierSignatureCinetPay ci-dessous).
// ═══════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const database_1 = __importDefault(require("../../config/database"));
const auth_middleware_1 = require("../../middleware/auth.middleware");
const env_1 = require("../../config/env");
const router = (0, express_1.Router)();
// Tarifs — à ajuster selon ta grille définitive
const TARIFS = {
    STANDARD: 18000,
    PRO: 32000,
};
// ─── GET /api/abonnement — Statut actuel (accessible même si suspendu) ───
router.get("/", auth_middleware_1.authMiddleware, async (req, res) => {
    const company = await database_1.default.company.findUnique({
        where: { id: req.user.companyId },
        select: {
            plan: true,
            statutAbonnement: true,
            dateFinEssai: true,
            dateProchainPaiement: true,
            montantAbonnement: true,
        },
    });
    res.json({ success: true, data: company });
});
// ─── GET /api/abonnement/historique — Paiements passés (ADMIN uniquement) ───
router.get("/historique", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)(["ADMIN"]), async (req, res) => {
    const paiements = await database_1.default.paiement.findMany({
        where: { companyId: req.user.companyId },
        orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: paiements });
});
// ─── POST /api/abonnement/initier — Démarre un paiement (ADMIN uniquement) ───
// Crée un paiement "EN_ATTENTE" et renvoie le lien de paiement Wave/OM
// généré par l'agrégateur. Le client est redirigé vers ce lien.
router.post("/initier", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)(["ADMIN"]), async (req, res) => {
    const { plan } = req.body;
    if (!TARIFS[plan]) {
        res.status(400).json({ success: false, message: "Plan invalide" });
        return;
    }
    const paiement = await database_1.default.paiement.create({
        data: {
            companyId: req.user.companyId,
            montant: TARIFS[plan],
            plan,
            moyenPaiement: "EN_ATTENTE", // renseigné par le webhook (WAVE ou ORANGE_MONEY)
            statut: "EN_ATTENTE",
        },
    });
    // ── À BRANCHER : appel réel à l'API CinetPay/PayDunya pour générer le lien ──
    // const lienPaiement = await cinetpay.creerPaiement({
    //   amount: TARIFS[plan],
    //   currency: "XOF",
    //   transaction_id: paiement.id,
    //   notify_url: `${env.API_URL}/api/abonnement/webhook`,
    //   return_url: `${env.FRONTEND_URL}/parametres/abonnement`,
    // });
    res.json({
        success: true,
        data: {
            paiementId: paiement.id,
            // lienPaiement, // décommenter une fois l'agrégateur branché
            montant: TARIFS[plan],
        },
    });
});
// ─── POST /api/abonnement/webhook — Confirmation reçue de l'agrégateur ───
// PAS d'authMiddleware ici : c'est l'agrégateur qui appelle, pas un user.
router.post("/webhook", async (req, res) => {
    // 1. Vérifier que la requête vient bien de l'agrégateur (anti-fraude)
    //    Exemple avec CinetPay : ils envoient un token à comparer.
    const signatureValide = verifierSignature(req);
    if (!signatureValide) {
        res.status(403).json({ success: false, message: "Signature invalide" });
        return;
    }
    const { transaction_id, statut } = req.body; // adapter aux champs réels de l'agrégateur
    const paiement = await database_1.default.paiement.findUnique({
        where: { id: transaction_id },
    });
    if (!paiement) {
        res.status(404).json({ success: false, message: "Paiement introuvable" });
        return;
    }
    if (statut === "ACCEPTED" || statut === "CONFIRME") {
        // Paiement confirmé → on active l'abonnement pour 30 jours
        const prochainPaiement = new Date();
        prochainPaiement.setDate(prochainPaiement.getDate() + 30);
        await database_1.default.$transaction([
            database_1.default.paiement.update({
                where: { id: paiement.id },
                data: { statut: "CONFIRME" },
            }),
            database_1.default.company.update({
                where: { id: paiement.companyId },
                data: {
                    plan: paiement.plan,
                    statutAbonnement: "ACTIF",
                    montantAbonnement: paiement.montant,
                    dateProchainPaiement: prochainPaiement,
                },
            }),
        ]);
    }
    else {
        await database_1.default.paiement.update({
            where: { id: paiement.id },
            data: { statut: "ECHOUE" },
        });
    }
    res.json({ success: true });
});
// ─── Vérification de signature (à adapter selon l'agrégateur choisi) ───
function verifierSignature(req) {
    // Exemple générique HMAC — CinetPay et PayDunya fournissent chacun
    // leur propre méthode dans leur documentation, à copier ici.
    const signatureRecue = req.headers["x-token"];
    if (!signatureRecue)
        return false;
    const attendu = crypto_1.default
        .createHmac("sha256", env_1.env.JWT_SECRET) // remplacer par la clé secrète de l'agrégateur
        .update(JSON.stringify(req.body))
        .digest("hex");
    return signatureRecue === attendu;
}
exports.default = router;
//# sourceMappingURL=abonnement.routes.js.map