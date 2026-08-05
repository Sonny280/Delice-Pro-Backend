"use strict";
// src/modules/auth/auth.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = exports.registerCompanySchema = void 0;
exports.registerCompany = registerCompany;
exports.login = login;
exports.generateToken = generateToken;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const database_1 = __importDefault(require("../../config/database"));
const env_1 = require("../../config/env");
const error_middleware_1 = require("../../middleware/error.middleware");
// ── Génération automatique du username ───────────────────────────────────────
// Transforme "Jean-Marc Koné" → "jeanmarc.kone"
// Ajoute un suffixe numérique si le username est déjà pris
function normaliserTexte(texte) {
    return texte
        .toLowerCase()
        .normalize("NFD") // Décompose les accents
        .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
        .replace(/[^a-z0-9]/g, "") // Garde uniquement lettres/chiffres
        .trim();
}
async function genererUsername(prenom, nom, companyId) {
    const base = `${normaliserTexte(prenom)}.${normaliserTexte(nom)}`;
    // Vérifier si le username de base est disponible
    const existe = await database_1.default.user.findFirst({
        where: { username: base, companyId },
    });
    if (!existe)
        return base;
    // Ajouter un suffixe numérique
    for (let i = 2; i <= 99; i++) {
        const candidat = `${base}${i}`;
        const existe2 = await database_1.default.user.findFirst({
            where: { username: candidat, companyId },
        });
        if (!existe2)
            return candidat;
    }
    return `${base}${Date.now()}`; // Fallback ultime
}
// SECURITE : Suivi des tentatives de connexion échouées
const tentativesEchouees = new Map();
const MAX_TENTATIVES = 5;
const BLOCAGE_MS = 15 * 60 * 1000;
exports.registerCompanySchema = zod_1.z.object({
    company: zod_1.z.object({
        nom: zod_1.z.string().min(2, "Le nom doit faire au moins 2 caractères"),
        type: zod_1.z.string().default("Pâtisserie"),
        adresse: zod_1.z.string().optional(),
        ville: zod_1.z.string().optional(),
        pays: zod_1.z.string().optional(),
        telephone: zod_1.z.string().optional(),
        email: zod_1.z.string().email("Email invalide").optional(),
        siteWeb: zod_1.z.string().optional(),
        devise: zod_1.z.string().default("F"),
        couleurPrincipale: zod_1.z.string().default("#1a2744"),
    }),
    admin: zod_1.z.object({
        prenom: zod_1.z.string().min(1, "Le prénom est requis"),
        nom: zod_1.z.string().min(1, "Le nom est requis"),
        email: zod_1.z.string().email("Email invalide"),
        password: zod_1.z.string().min(8, "Le mot de passe doit faire au moins 8 caractères"),
    }),
});
// CORRECTION : companyId optionnel — login par email seul
exports.loginSchema = zod_1.z.object({
    // Accepte username (jean.kone) OU email (jean@patisserie.ci)
    email: zod_1.z.string().min(1, "Identifiant obligatoire"),
    password: zod_1.z.string().min(1, "Le mot de passe est requis"),
    companyId: zod_1.z.string().optional(),
});
async function registerCompany(data) {
    const existingUser = await database_1.default.user.findFirst({
        where: { email: data.admin.email },
    });
    if (existingUser)
        throw new error_middleware_1.AppError("Cet email est déjà utilisé", 409);
    const mdp = data.admin.password;
    if (mdp.length < 8)
        throw new error_middleware_1.AppError("Le mot de passe doit contenir au moins 8 caractères", 400);
    if (!/\d/.test(mdp))
        throw new error_middleware_1.AppError("Le mot de passe doit contenir au moins un chiffre", 400);
    if (!/[a-zA-Z]/.test(mdp))
        throw new error_middleware_1.AppError("Le mot de passe doit contenir au moins une lettre", 400);
    const passwordHash = await bcryptjs_1.default.hash(data.admin.password, 12);
    const result = await database_1.default.$transaction(async (tx) => {
        const company = await tx.company.create({
            data: {
                nom: data.company.nom,
                type: data.company.type,
                adresse: data.company.adresse,
                ville: data.company.ville,
                pays: data.company.pays,
                telephone: data.company.telephone,
                email: data.company.email,
                siteWeb: data.company.siteWeb,
                devise: data.company.devise,
                couleurPrincipale: data.company.couleurPrincipale,
                // En mode DESKTOP, le plan vient de la licence activée (voir
                // main.js / server.ts) — on l'applique dès la création, pas besoin
                // d'attendre un redémarrage pour que les fonctionnalités Pro
                // s'activent. En mode SAAS, ceci n'a aucun effet (reste ESSAI par
                // défaut, géré ensuite par le module abonnement).
                ...(env_1.env.DEPLOY_MODE === "DESKTOP"
                    ? {
                        plan: process.env.LICENSE_PLAN === "PRO" ? "PRO" : "STANDARD",
                        statutAbonnement: "ACTIF",
                    }
                    : {}),
            },
        });
        // Générer le username de l'admin
        const usernameAdmin = await genererUsername(data.admin.prenom, data.admin.nom, company.id);
        const admin = await tx.user.create({
            data: {
                prenom: data.admin.prenom,
                nom: data.admin.nom,
                email: data.admin.email,
                username: usernameAdmin,
                passwordHash,
                role: "ADMIN",
                companyId: company.id,
            },
        });
        // Catégories de charges par défaut — créées ici, à la création de
        // l'entreprise, plutôt qu'au premier clic sur la page "Charges".
        // Avant : le frontend essayait de les créer lui-même si la liste
        // était vide, mais cette création est réservée à ADMIN/RESPONSABLE
        // côté serveur. Si le premier utilisateur à ouvrir la page était un
        // caissier ou un chef pâtissier, les créations échouaient toutes en
        // 403 (silencieusement), laissant la liste vide pour toujours.
        // En les créant ici, elles existent dès le départ, pour tout le monde.
        const CATEGORIES_CHARGES_DEFAUT = [
            { nom: "Personnel", icone: "👷", couleur: "#3B82F6" },
            { nom: "Locaux", icone: "🏠", couleur: "#8B5CF6" },
            { nom: "Matériel", icone: "🔧", couleur: "#F59E0B" },
            { nom: "Consommables", icone: "📦", couleur: "#10B981" },
            { nom: "Logistique", icone: "🚚", couleur: "#6366F1" },
            { nom: "Commercial", icone: "📢", couleur: "#EC4899" },
            { nom: "Financier", icone: "🏦", couleur: "#14B8A6" },
            { nom: "Divers", icone: "📋", couleur: "#6B7280" },
        ];
        await tx.categorieCharge.createMany({
            data: CATEGORIES_CHARGES_DEFAUT.map((cat, i) => ({
                ...cat,
                ordre: i,
                companyId: company.id,
            })),
        });
        return { company, admin };
    });
    const token = generateToken(result.admin.id, result.company.id, "ADMIN", result.admin.email);
    return {
        token,
        company: { id: result.company.id, nom: result.company.nom, couleurPrincipale: result.company.couleurPrincipale, devise: result.company.devise },
        user: { id: result.admin.id, prenom: result.admin.prenom, nom: result.admin.nom, email: result.admin.email, role: result.admin.role },
    };
}
async function login(data) {
    const cleEmail = data.email.toLowerCase();
    const maintenant = Date.now();
    // SECURITE : Vérifier le blocage avant tout
    const tentatives = tentativesEchouees.get(cleEmail);
    if (tentatives && tentatives.count >= MAX_TENTATIVES) {
        const tempsEcoule = maintenant - tentatives.lastAttempt;
        if (tempsEcoule < BLOCAGE_MS) {
            const minutesRestantes = Math.ceil((BLOCAGE_MS - tempsEcoule) / 60000);
            throw new error_middleware_1.AppError(`Compte bloqué après ${MAX_TENTATIVES} tentatives. Réessayez dans ${minutesRestantes} minute(s).`, 429);
        }
        tentativesEchouees.delete(cleEmail);
    }
    // Trouver l'utilisateur par email (companyId optionnel)
    const user = await database_1.default.user.findFirst({
        where: {
            email: cleEmail,
            actif: true,
            ...(data.companyId ? { companyId: data.companyId } : {}),
        },
        include: {
            company: {
                select: { id: true, nom: true, couleurPrincipale: true, devise: true },
            },
        },
    });
    if (!user) {
        const ex = tentativesEchouees.get(cleEmail) ?? { count: 0, lastAttempt: 0 };
        tentativesEchouees.set(cleEmail, { count: ex.count + 1, lastAttempt: Date.now() });
        throw new error_middleware_1.AppError("Email ou mot de passe incorrect", 401);
    }
    const passwordValid = await bcryptjs_1.default.compare(data.password, user.passwordHash);
    if (!passwordValid) {
        const ex = tentativesEchouees.get(cleEmail) ?? { count: 0, lastAttempt: 0 };
        const newCount = ex.count + 1;
        tentativesEchouees.set(cleEmail, { count: newCount, lastAttempt: Date.now() });
        const restantes = MAX_TENTATIVES - newCount;
        throw new error_middleware_1.AppError(restantes > 0
            ? `Mot de passe incorrect. ${restantes} tentative(s) avant blocage.`
            : `Compte bloqué pour 15 minutes.`, 401);
    }
    // Connexion réussie → reset compteur
    tentativesEchouees.delete(cleEmail);
    const token = generateToken(user.id, user.companyId, user.role, user.email);
    return {
        token,
        company: user.company,
        user: {
            id: user.id,
            prenom: user.prenom,
            nom: user.nom,
            email: user.email,
            username: user.username,
            role: user.role,
        },
    };
}
function generateToken(userId, companyId, role, email) {
    return jsonwebtoken_1.default.sign({ userId, companyId, role, email }, env_1.env.JWT_SECRET, { expiresIn: env_1.env.JWT_EXPIRES_IN });
}
//# sourceMappingURL=auth.service.js.map