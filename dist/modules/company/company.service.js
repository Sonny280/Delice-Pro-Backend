"use strict";
// ═══════════════════════════════════════════════════════════════
// src/modules/company/company.service.ts
// Gestion des infos de l'entreprise (paramètres)
// ═══════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCompanySchema = void 0;
exports.getCompany = getCompany;
exports.updateCompany = updateCompany;
exports.uploadLogo = uploadLogo;
exports.getDashboardData = getDashboardData;
const zod_1 = require("zod");
const cloudinary_1 = require("cloudinary");
const database_1 = __importDefault(require("../../config/database"));
const env_1 = require("../../config/env");
const error_middleware_1 = require("../../middleware/error.middleware");
// Configurer Cloudinary pour l'upload de logos
if (env_1.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary_1.v2.config({
        cloud_name: env_1.env.CLOUDINARY_CLOUD_NAME,
        api_key: env_1.env.CLOUDINARY_API_KEY,
        api_secret: env_1.env.CLOUDINARY_API_SECRET,
    });
}
// ─── Schéma de mise à jour ───────────────────────────────────────
exports.updateCompanySchema = zod_1.z.object({
    nom: zod_1.z.string().min(2).optional(),
    type: zod_1.z.string().optional(),
    adresse: zod_1.z.string().optional(),
    ville: zod_1.z.string().optional(),
    pays: zod_1.z.string().optional(),
    telephone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    siteWeb: zod_1.z.string().optional(),
    devise: zod_1.z.string().optional(),
    couleurPrincipale: zod_1.z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, "Format hex invalide (ex: #1a2744)")
        .optional(),
});
// ─── Récupérer les infos de l'entreprise ────────────────────────
async function getCompany(companyId) {
    const company = await database_1.default.company.findUnique({
        where: { id: companyId },
        select: {
            id: true,
            nom: true,
            type: true,
            adresse: true,
            ville: true,
            pays: true,
            telephone: true,
            email: true,
            siteWeb: true,
            logoUrl: true,
            devise: true,
            couleurPrincipale: true,
            createdAt: true,
        },
    });
    if (!company)
        throw new error_middleware_1.AppError("Entreprise introuvable", 404);
    return company;
}
// ─── Mettre à jour les infos de l'entreprise ────────────────────
async function updateCompany(companyId, data) {
    return database_1.default.company.update({
        where: { id: companyId },
        data,
    });
}
// ─── Uploader le logo ────────────────────────────────────────────
async function uploadLogo(companyId, fileBuffer, mimetype) {
    if (env_1.env.CLOUDINARY_CLOUD_NAME) {
        const base64 = `data:${mimetype};base64,${fileBuffer.toString("base64")}`;
        const result = await cloudinary_1.v2.uploader.upload(base64, {
            folder: `delice-pro/logos/${companyId}`,
            transformation: [
                { width: 200, height: 200, crop: "fit" },
                { format: "webp", quality: "auto" },
            ],
        });
        await database_1.default.company.update({
            where: { id: companyId },
            data: { logoUrl: result.secure_url },
        });
        return result.secure_url;
    }
    const maxSize = 500 * 1024;
    if (fileBuffer.length > maxSize) {
        throw new error_middleware_1.AppError(`Le logo est trop lourd (${Math.round(fileBuffer.length / 1024)} Ko). Maximum : 500 Ko.`, 400);
    }
    const dataUrl = `data:${mimetype};base64,${fileBuffer.toString("base64")}`;
    await database_1.default.company.update({
        where: { id: companyId },
        data: { logoUrl: dataUrl },
    });
    return dataUrl;
}
// ─── Dashboard : données agrégées pour la page d'accueil ────────
async function getDashboardData(companyId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    // ── Requêtes de base (tables toujours présentes) ──────────────
    const [ventesAujourdhui, pertesAujourdhui, productionsAujourdhui, alertesStock, dernieresVentes,] = await Promise.all([
        database_1.default.vente.aggregate({
            where: { companyId, date: { gte: today, lt: tomorrow } },
            _sum: { montantTotal: true },
            _count: true,
        }),
        database_1.default.perte.aggregate({
            where: { companyId, date: { gte: today, lt: tomorrow } },
            _sum: { valeur: true },
        }),
        database_1.default.production.findMany({
            where: { companyId, date: { gte: today, lt: tomorrow } },
            select: {
                id: true,
                pateTheorique: true,
                pateEffective: true,
                ecartPct: true,
                quantiteFarine: true,
                recette: { select: { nom: true } },
            },
        }),
        // Requête SQL brute — colonnes de base toujours présentes
        database_1.default.$queryRaw `
      SELECT id, nom, "stockActuel", "seuilAlerte"
      FROM "MatierePremiere"
      WHERE "companyId" = ${companyId}
        AND actif = true
        AND "stockActuel" <= "seuilAlerte"
      LIMIT 20
    `,
        database_1.default.vente.findMany({
            where: { companyId },
            select: {
                id: true,
                montantTotal: true,
                modePaiement: true,
                date: true,
                lignes: {
                    select: {
                        quantite: true,
                        sousTotal: true,
                        produit: { select: { nom: true } },
                    },
                },
                user: { select: { prenom: true, nom: true } },
            },
            orderBy: { date: "desc" },
            take: 5,
        }),
    ]);
    // ── Top produits (groupBy peut échouer sur certaines versions) ──
    let topProduits = [];
    try {
        const topProduitsRaw = await database_1.default.ligneVente.groupBy({
            by: ["produitId"],
            where: {
                vente: { companyId, date: { gte: today, lt: tomorrow } },
            },
            _sum: { quantite: true, sousTotal: true },
            _count: true,
            orderBy: { _sum: { sousTotal: "desc" } },
            take: 5,
        });
        const topProduitsIds = topProduitsRaw.map((t) => t.produitId);
        const topProduitsDetails = topProduitsIds.length > 0
            ? await database_1.default.produit.findMany({
                where: { id: { in: topProduitsIds } },
                select: { id: true, nom: true },
            })
            : [];
        topProduits = topProduitsRaw.map((t) => ({
            produitId: t.produitId,
            nom: topProduitsDetails.find((p) => p.id === t.produitId)?.nom ?? "—",
            quantite: t._sum?.quantite ?? 0,
            ca: Math.round(t._sum?.sousTotal ?? 0),
        }));
    }
    catch (_err) {
        // groupBy échoue si aucune vente aujourd'hui — retourner tableau vide
        topProduits = [];
    }
    // ── Objectif CA et seuil pertes (colonnes ajoutées en migration) ──
    // On utilise $queryRaw pour éviter un crash si la migration n'a pas encore été jouée
    let objectifCA = 0;
    let seuilPertes = 0;
    try {
        const settings = await database_1.default.$queryRaw `
      SELECT "objectifCA", "seuilPertes"
      FROM "Company"
      WHERE id = ${companyId}
      LIMIT 1
    `;
        if (settings[0]) {
            objectifCA = settings[0].objectifCA ?? 0;
            seuilPertes = settings[0].seuilPertes ?? 0;
        }
    }
    catch (_err) {
        // Colonnes pas encore en DB → migration à jouer, on retourne 0
        objectifCA = 0;
        seuilPertes = 0;
    }
    return {
        caAujourdhui: ventesAujourdhui._sum.montantTotal ?? 0,
        nbTransactionsAujourdhui: ventesAujourdhui._count,
        pertesAujourdhui: pertesAujourdhui._sum.valeur ?? 0,
        productionsAujourdhui,
        alertesStock,
        dernieresVentes,
        topProduits,
        objectifCA,
        seuilPertes,
    };
}
//# sourceMappingURL=company.service.js.map