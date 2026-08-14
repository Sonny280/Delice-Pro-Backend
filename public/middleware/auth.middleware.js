"use strict";
// ═══════════════════════════════════════════════════════════════
// src/middleware/auth.middleware.ts
// Middleware d'authentification JWT
//
// Un middleware est une fonction qui s'exécute AVANT le controller.
// Son rôle : vérifier que la requête vient d'un utilisateur connecté.
//
// Fonctionnement :
// 1. Le client envoie le token JWT dans le header Authorization
// 2. On extrait et vérifie le token
// 3. On charge l'utilisateur depuis la BDD
// 4. On stocke l'utilisateur dans req.user pour le controller
// ═══════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePlan = exports.requireRole = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const database_1 = __importDefault(require("../config/database"));
// ─── Middleware principal : vérifie que l'utilisateur est connecté ───
const authMiddleware = async (req, res, next // next() = passe au middleware/controller suivant
) => {
    try {
        // 1. Récupérer le header Authorization
        // Format attendu : "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI..."
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            // 401 = Non autorisé (pas de token)
            res.status(401).json({
                success: false,
                message: "Accès refusé : aucun token fourni",
            });
            return;
        }
        // 2. Extraire le token (enlever "Bearer " du début)
        const token = authHeader.split(" ")[1];
        // 3. Vérifier et décoder le token
        // jwt.verify lance une exception si le token est invalide ou expiré
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        // 4. Vérifier que l'utilisateur existe toujours en BDD et est actif
        // (il pourrait avoir été désactivé depuis la création du token)
        // On charge aussi le statut d'abonnement de la company en même temps
        // (un seul aller-retour BDD, pas de requête supplémentaire).
        const user = await database_1.default.user.findFirst({
            where: {
                id: decoded.userId,
                companyId: decoded.companyId,
                actif: true, // Seulement les utilisateurs actifs
            },
            select: {
                id: true,
                companyId: true,
                role: true,
                email: true,
                company: {
                    select: { statutAbonnement: true, plan: true, dateFinEssai: true },
                },
            },
        });
        if (!user) {
            res.status(401).json({
                success: false,
                message: "Token invalide : utilisateur introuvable ou inactif",
            });
            return;
        }
        // 5. Blocage automatique pour impayé ou essai expiré — UNIQUEMENT en
        // mode SAAS. En mode DESKTOP ou DESKTOP_RESEAU (app Electron vendue en
        // licence, base locale ou serveur d'entreprise), il n'y a pas
        // d'abonnement à vérifier : le client a payé une licence, ça tourne.
        if (env_1.env.DEPLOY_MODE === "SAAS") {
            // On laisse passer quelques routes essentielles même si le compte est
            // suspendu : la page d'abonnement (pour payer) et l'auth (pour se
            // déconnecter proprement). Tout le reste renvoie 402 Payment Required.
            const ROUTES_AUTORISEES_SI_SUSPENDU = ["/api/abonnement", "/api/auth"];
            const routeAutorisee = ROUTES_AUTORISEES_SI_SUSPENDU.some((r) => req.path.startsWith(r));
            const essaiExpire = user.company.statutAbonnement === "ESSAI" &&
                user.company.dateFinEssai !== null &&
                user.company.dateFinEssai < new Date();
            if (!routeAutorisee &&
                (user.company.statutAbonnement === "SUSPENDU" ||
                    user.company.statutAbonnement === "ANNULE" ||
                    essaiExpire)) {
                res.status(402).json({
                    success: false,
                    message: "Abonnement expiré ou paiement en attente. Merci de régulariser pour continuer à utiliser Delice Pro.",
                    code: "SUBSCRIPTION_REQUIRED",
                });
                return;
            }
        }
        // 6. Limite de postes simultanés selon le plan. Un "poste" = un
        // navigateur/ordinateur distinct, identifié par un deviceId généré
        // côté frontend et envoyé dans le header X-Device-Id (voir api.ts).
        // Un poste sans activité depuis 15 min ne compte plus dans la limite
        // (ordinateur éteint, session abandonnée) — libération automatique.
        const deviceId = req.headers["x-device-id"];
        if (deviceId) {
            const LIMITE_POSTES = {
                ESSAI: 1,
                STANDARD: 5,
                PRO: Infinity,
            };
            const limite = LIMITE_POSTES[user.company.plan] ?? 1;
            const posteExistant = await database_1.default.posteActif.findUnique({
                where: { companyId_deviceId: { companyId: user.companyId, deviceId } },
            });
            // Poste déjà connu : simple mise à jour du "dernier vu", pas de
            // nettoyage/comptage à chaque requête (coûteux et inutile pour un
            // poste déjà admis).
            if (posteExistant) {
                await database_1.default.posteActif.update({
                    where: { companyId_deviceId: { companyId: user.companyId, deviceId } },
                    data: { derniereActivite: new Date() },
                });
            }
            else {
                // Nouveau poste : on nettoie les postes inactifs (>15 min) avant
                // de compter, pour libérer les places des ordinateurs éteints.
                const seuilInactivite = new Date(Date.now() - 15 * 60 * 1000);
                await database_1.default.posteActif.deleteMany({
                    where: { companyId: user.companyId, derniereActivite: { lt: seuilInactivite } },
                });
                const nbPostesActifs = await database_1.default.posteActif.count({
                    where: { companyId: user.companyId },
                });
                if (nbPostesActifs >= limite) {
                    res.status(403).json({
                        success: false,
                        message: `Limite de ${limite} poste(s) atteinte pour votre plan (${user.company.plan}). Fermez une session ailleurs ou passez au plan supérieur.`,
                        code: "DEVICE_LIMIT_REACHED",
                    });
                    return;
                }
                // IMPORTANT : le dashboard envoie plusieurs requêtes EN MÊME TEMPS
                // (Promise.all) au premier chargement. Si plusieurs d'entre elles
                // arrivent ici avant qu'aucune n'ait eu le temps d'enregistrer le
                // poste, un simple create() plante (deux requêtes créent la même
                // ligne en même temps → erreur de contrainte unique). upsert()
                // gère ça correctement : si la ligne existe déjà au moment de
                // l'écriture (créée entre-temps par une requête parallèle), il la
                // met simplement à jour au lieu d'échouer.
                await database_1.default.posteActif.upsert({
                    where: { companyId_deviceId: { companyId: user.companyId, deviceId } },
                    create: { companyId: user.companyId, deviceId },
                    update: { derniereActivite: new Date() },
                });
            }
        }
        // 7. Stocker les infos utilisateur dans req.user pour les controllers
        req.user = { id: user.id, companyId: user.companyId, role: user.role, email: user.email };
        req.company = { plan: user.company.plan, statutAbonnement: user.company.statutAbonnement };
        // 8. Passer au middleware/controller suivant
        next();
    }
    catch (error) {
        // Le token est invalide ou expiré
        res.status(401).json({
            success: false,
            message: "Token invalide ou expiré",
        });
    }
};
exports.authMiddleware = authMiddleware;
// ─── Factory de middleware : vérifie les rôles autorisés ───
// Usage : router.get('/admin', authMiddleware, requireRole(['ADMIN']), controller)
const requireRole = (roles) => {
    return (req, res, next) => {
        // req.user est rempli par authMiddleware (appelé avant)
        if (!req.user) {
            res.status(401).json({ success: false, message: "Non authentifié" });
            return;
        }
        // Vérifier si le rôle de l'utilisateur est dans la liste autorisée
        if (!roles.includes(req.user.role)) {
            // 403 = Interdit (connecté mais pas les droits suffisants)
            res.status(403).json({
                success: false,
                message: `Accès refusé. Rôles autorisés : ${roles.join(", ")}`,
            });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
// ─── Factory de middleware : restreint une fonctionnalité à certains plans ───
// Usage : router.get('/avance', authMiddleware, requirePlan(['PRO']), controller)
const requirePlan = (plans) => {
    return (req, res, next) => {
        if (!req.company) {
            res.status(401).json({ success: false, message: "Non authentifié" });
            return;
        }
        if (!plans.includes(req.company.plan)) {
            res.status(403).json({
                success: false,
                message: `Cette fonctionnalité nécessite le plan : ${plans.join(" ou ")}. Contactez-nous pour mettre à niveau.`,
                code: "PLAN_UPGRADE_REQUIRED",
            });
            return;
        }
        next();
    };
};
exports.requirePlan = requirePlan;
//# sourceMappingURL=auth.middleware.js.map