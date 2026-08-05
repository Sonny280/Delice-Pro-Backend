// ═══════════════════════════════════════════════════════════════
// src/modules/company/company.service.ts
// Gestion des infos de l'entreprise (paramètres)
// ═══════════════════════════════════════════════════════════════

import { z } from "zod";
import { v2 as cloudinary } from "cloudinary";
import prisma from "../../config/database";
import { env } from "../../config/env";
import { AppError } from "../../middleware/error.middleware";

// Configurer Cloudinary pour l'upload de logos
if (env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

// ─── Schéma de mise à jour ───────────────────────────────────────
export const updateCompanySchema = z.object({
  nom: z.string().min(2).optional(),
  type: z.string().optional(),
  adresse: z.string().optional(),
  ville: z.string().optional(),
  pays: z.string().optional(),
  telephone: z.string().optional(),
  email: z.string().email().optional(),
  siteWeb: z.string().optional(),
  devise: z.string().optional(),
  couleurPrincipale: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Format hex invalide (ex: #1a2744)")
    .optional(),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

// ─── Récupérer les infos de l'entreprise ────────────────────────
export async function getCompany(companyId: string) {
  const company = await prisma.company.findUnique({
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

  if (!company) throw new AppError("Entreprise introuvable", 404);
  return company;
}

// ─── Mettre à jour les infos de l'entreprise ────────────────────
export async function updateCompany(
  companyId: string,
  data: UpdateCompanyInput
) {
  return prisma.company.update({
    where: { id: companyId },
    data,
  });
}

// ─── Uploader le logo ────────────────────────────────────────────
export async function uploadLogo(
  companyId: string,
  fileBuffer: Buffer,
  mimetype: string
): Promise<string> {
  if (env.CLOUDINARY_CLOUD_NAME) {
    const base64 = `data:${mimetype};base64,${fileBuffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(base64, {
      folder: `delice-pro/logos/${companyId}`,
      transformation: [
        { width: 200, height: 200, crop: "fit" },
        { format: "webp", quality: "auto" },
      ],
    });
    await prisma.company.update({
      where: { id: companyId },
      data: { logoUrl: result.secure_url },
    });
    return result.secure_url;
  }

  const maxSize = 500 * 1024;
  if (fileBuffer.length > maxSize) {
    throw new AppError(
      `Le logo est trop lourd (${Math.round(fileBuffer.length / 1024)} Ko). Maximum : 500 Ko.`,
      400
    );
  }

  const dataUrl = `data:${mimetype};base64,${fileBuffer.toString("base64")}`;
  await prisma.company.update({
    where: { id: companyId },
    data: { logoUrl: dataUrl },
  });
  return dataUrl;
}

// ─── Dashboard : données agrégées pour la page d'accueil ────────
export async function getDashboardData(companyId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // ── Requêtes de base (tables toujours présentes) ──────────────
  const [
    ventesAujourdhui,
    pertesAujourdhui,
    productionsAujourdhui,
    alertesStock,
    dernieresVentes,
  ] = await Promise.all([

    prisma.vente.aggregate({
      where: { companyId, date: { gte: today, lt: tomorrow } },
      _sum: { montantTotal: true },
      _count: true,
    }),

    prisma.perte.aggregate({
      where: { companyId, date: { gte: today, lt: tomorrow } },
      _sum: { valeur: true },
    }),

    prisma.production.findMany({
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
    prisma.$queryRaw<{ id: string; nom: string; stockActuel: number; seuilAlerte: number }[]>`
      SELECT id, nom, "stockActuel", "seuilAlerte"
      FROM "MatierePremiere"
      WHERE "companyId" = ${companyId}
        AND actif = true
        AND "stockActuel" <= "seuilAlerte"
      LIMIT 20
    `,

    prisma.vente.findMany({
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
  let topProduits: { produitId: string; nom: string; quantite: number; ca: number }[] = [];
  try {
    const topProduitsRaw = await prisma.ligneVente.groupBy({
      by: ["produitId"],
      where: {
        vente: { companyId, date: { gte: today, lt: tomorrow } },
      },
      _sum:   { quantite: true, sousTotal: true },
      _count: true,
      orderBy: { _sum: { sousTotal: "desc" } },
      take: 5,
    });

    const topProduitsIds = topProduitsRaw.map((t) => t.produitId);
    const topProduitsDetails = topProduitsIds.length > 0
      ? await prisma.produit.findMany({
          where: { id: { in: topProduitsIds } },
          select: { id: true, nom: true },
        })
      : [];

    topProduits = topProduitsRaw.map((t) => ({
      produitId: t.produitId,
      nom:       topProduitsDetails.find((p) => p.id === t.produitId)?.nom ?? "—",
      quantite:  t._sum?.quantite ?? 0,
      ca:        Math.round(t._sum?.sousTotal ?? 0),
    }));
  } catch (_err) {
    // groupBy échoue si aucune vente aujourd'hui — retourner tableau vide
    topProduits = [];
  }

  // ── Objectif CA et seuil pertes (colonnes ajoutées en migration) ──
  // On utilise $queryRaw pour éviter un crash si la migration n'a pas encore été jouée
  let objectifCA = 0;
  let seuilPertes = 0;
  try {
    const settings = await prisma.$queryRaw<{ objectifCA: number; seuilPertes: number }[]>`
      SELECT "objectifCA", "seuilPertes"
      FROM "Company"
      WHERE id = ${companyId}
      LIMIT 1
    `;
    if (settings[0]) {
      objectifCA  = settings[0].objectifCA  ?? 0;
      seuilPertes = settings[0].seuilPertes ?? 0;
    }
  } catch (_err) {
    // Colonnes pas encore en DB → migration à jouer, on retourne 0
    objectifCA  = 0;
    seuilPertes = 0;
  }

  return {
    caAujourdhui:             ventesAujourdhui._sum.montantTotal ?? 0,
    nbTransactionsAujourdhui: ventesAujourdhui._count,
    pertesAujourdhui:         pertesAujourdhui._sum.valeur ?? 0,
    productionsAujourdhui,
    alertesStock,
    dernieresVentes,
    topProduits,
    objectifCA,
    seuilPertes,
  };
}

