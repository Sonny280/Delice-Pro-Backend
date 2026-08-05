"use strict";
// src/modules/users/users.routes.ts
// Gestion des utilisateurs + reset mot de passe par l'admin
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = __importDefault(require("../../config/database"));
const auth_middleware_1 = require("../../middleware/auth.middleware");
// Générer username depuis prénom + nom
function normaliser(t) {
    return t.toLowerCase().normalize("NFD")
        .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
}
async function genererUsername(prenom, nom, companyId) {
    const base = `${normaliser(prenom)}.${normaliser(nom)}`;
    const existe = await database_1.default.user.findFirst({ where: { username: base, companyId } });
    if (!existe)
        return base;
    for (let i = 2; i <= 99; i++) {
        const c = `${base}${i}`;
        if (!await database_1.default.user.findFirst({ where: { username: c, companyId } }))
            return c;
    }
    return `${base}${Date.now()}`;
}
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// ── GET /api/users — Liste des utilisateurs de la company ────────────────────
router.get("/", async (req, res) => {
    const users = await database_1.default.user.findMany({
        where: { companyId: req.user.companyId },
        select: {
            id: true, prenom: true, nom: true, email: true,
            role: true, actif: true, createdAt: true,
        },
        orderBy: { createdAt: "asc" },
    });
    res.json({ success: true, data: users });
});
// ── POST /api/users — Créer un utilisateur ───────────────────────────────────
router.post("/", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE"]), async (req, res) => {
    const data = zod_1.z.object({
        prenom: zod_1.z.string().min(1),
        nom: zod_1.z.string().min(1),
        email: zod_1.z.string().email(),
        // CORRECTION : COMPTABLE manquait ici — la page Paramètres propose ce
        // rôle dans son formulaire, mais le serveur le rejetait en 400.
        role: zod_1.z.enum(["ADMIN", "RESPONSABLE", "GESTIONNAIRE", "CAISSIER", "CHEF_PATISSIER", "COMPTABLE"]),
        password: zod_1.z.string().min(6, "Minimum 6 caractères"),
    }).parse(req.body);
    const existe = await database_1.default.user.findFirst({
        where: { email: data.email.toLowerCase(), companyId: req.user.companyId },
    });
    if (existe) {
        res.status(409).json({ success: false, message: "Cet email est déjà utilisé" });
        return;
    }
    const passwordHash = await bcryptjs_1.default.hash(data.password, 12);
    const username = await genererUsername(data.prenom, data.nom, req.user.companyId);
    const user = await database_1.default.user.create({
        data: {
            prenom: data.prenom, nom: data.nom,
            email: data.email.toLowerCase(),
            username,
            passwordHash, role: data.role,
            companyId: req.user.companyId,
        },
        select: { id: true, prenom: true, nom: true, email: true, username: true, role: true, actif: true },
    });
    res.status(201).json({ success: true, data: user });
});
// ── PUT /api/users/:id/reset-password — Reset MDP par admin ─────────────────
// SECURITE : Seuls ADMIN et RESPONSABLE peuvent réinitialiser un mot de passe
router.put("/:id/reset-password", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE"]), async (req, res) => {
    const { newPassword } = zod_1.z.object({
        newPassword: zod_1.z.string().min(6, "Minimum 6 caractères"),
    }).parse(req.body);
    // Vérifier que l'utilisateur appartient à la même company
    const user = await database_1.default.user.findFirst({
        where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!user) {
        res.status(404).json({ success: false, message: "Utilisateur introuvable" });
        return;
    }
    // Empêcher un RESPONSABLE de modifier le mot de passe d'un ADMIN
    if (user.role === "ADMIN" && req.user.role !== "ADMIN") {
        res.status(403).json({
            success: false,
            message: "Seul un administrateur peut modifier le mot de passe d'un autre administrateur",
        });
        return;
    }
    const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
    await database_1.default.user.update({
        where: { id: req.params.id },
        data: { passwordHash },
    });
    res.json({ success: true, message: "Mot de passe réinitialisé avec succès" });
});
// ── PUT /api/users/me/username — Changer son propre username ───────────────
// DOIT être AVANT /:id
router.put("/me/username", async (req, res) => {
    const { username } = zod_1.z.object({
        username: zod_1.z.string()
            .min(3, "Minimum 3 caractères")
            .max(30, "Maximum 30 caractères")
            .regex(/^[a-z0-9._-]+$/, "Uniquement lettres minuscules, chiffres, points et tirets"),
    }).parse(req.body);
    const existe = await database_1.default.user.findFirst({
        where: { username, companyId: req.user.companyId },
    });
    if (existe && existe.id !== req.user.id) {
        res.status(409).json({ success: false, message: "Ce nom d'utilisateur est déjà pris" });
        return;
    }
    const updated = await database_1.default.user.update({
        where: { id: req.user.id },
        data: { username },
        select: { id: true, prenom: true, nom: true, email: true, username: true, role: true },
    });
    res.json({ success: true, data: updated, message: "Nom d'utilisateur mis à jour ✅" });
});
// ── PUT /api/users/me/password — Changer son propre mot de passe ─────────────
// DOIT être AVANT /:id sinon Express interprète "me" comme un ID
router.put("/me/password", async (req, res) => {
    const { ancienMdp, nouveauMdp } = zod_1.z.object({
        ancienMdp: zod_1.z.string().min(1, "Ancien mot de passe requis"),
        nouveauMdp: zod_1.z.string()
            .min(6, "Minimum 6 caractères")
            .regex(/\d/, "Au moins un chiffre requis"),
    }).parse(req.body);
    const user = await database_1.default.user.findUnique({
        where: { id: req.user.id },
        select: { passwordHash: true },
    });
    if (!user) {
        res.status(404).json({ success: false, message: "Utilisateur introuvable" });
        return;
    }
    const ok = await bcryptjs_1.default.compare(ancienMdp, user.passwordHash);
    if (!ok) {
        res.status(401).json({ success: false, message: "Ancien mot de passe incorrect" });
        return;
    }
    const passwordHash = await bcryptjs_1.default.hash(nouveauMdp, 12);
    await database_1.default.user.update({
        where: { id: req.user.id },
        data: { passwordHash },
    });
    res.json({ success: true, message: "Mot de passe modifié avec succès ✅" });
});
// ── PUT /api/users/:id — Modifier un utilisateur ────────────────────────────
router.put("/:id", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE"]), async (req, res) => {
    const data = zod_1.z.object({
        prenom: zod_1.z.string().min(1).optional(),
        nom: zod_1.z.string().min(1).optional(),
        // CORRECTION : même oubli que sur POST / — COMPTABLE ajouté.
        role: zod_1.z.enum(["ADMIN", "RESPONSABLE", "GESTIONNAIRE", "CAISSIER", "CHEF_PATISSIER", "COMPTABLE"]).optional(),
        actif: zod_1.z.boolean().optional(),
    }).parse(req.body);
    const user = await database_1.default.user.findFirst({
        where: { id: req.params.id, companyId: req.user.companyId },
    });
    if (!user) {
        res.status(404).json({ success: false, message: "Utilisateur introuvable" });
        return;
    }
    const updated = await database_1.default.user.update({
        where: { id: req.params.id },
        data,
        select: { id: true, prenom: true, nom: true, email: true, role: true, actif: true },
    });
    res.json({ success: true, data: updated });
});
exports.default = router;
//# sourceMappingURL=users.routes.js.map