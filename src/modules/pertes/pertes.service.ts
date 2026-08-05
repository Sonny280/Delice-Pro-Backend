// src/modules/pertes/pertes.service.ts
// Ameliorations :
// - Filtres par periode, par type, par cause
// - Stats enrichies : top causes, evolution, valeur journaliere
// - stockGere respecte pour les MP
// - Seuil d'alerte mensuel

import { z } from "zod";
import prisma from "../../config/database";
import { AppError } from "../../middleware/error.middleware";
import { deduireStockMP, calculerImpactMPProduitPerdu } from "../../utils/calculations";

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const createPerteProduitSchema = z.object({
  produitId: z.string({ required_error: "Le produit est requis" }),
  quantite:  z.number().positive("La quantite doit etre positive"),
  cause:     z.string().min(1, "La cause est requise"),
  date:      z.string().datetime().optional(),
  notes:     z.string().optional(),
  deductMP:  z.boolean().default(true),
});

export const createPerteMPSchema = z.object({
  mpId:     z.string({ required_error: "La matiere premiere est requise" }),
  quantite: z.number().positive("La quantite doit etre positive"),
  cause:    z.string().min(1, "La cause est requise"),
  date:     z.string().datetime().optional(),
  notes:    z.string().optional(),
});

export type CreatePerteProduitInput = z.infer<typeof createPerteProduitSchema>;
export type CreatePerteMPInput      = z.infer<typeof createPerteMPSchema>;

// ─── Causes prédéfinies ───────────────────────────────────────────────────────

export const CAUSES_PRODUIT_FINI = [
  "Invendu fin de journee",
  "Produit abime / casse",
  "Produit perime",
  "Erreur de commande client",
  "Chute / accident",
  "Defaut de fabrication",
  "Autre",
];

export const CAUSES_MATIERE_PREMIERE = [
  "Mauvais dosage corrige en production",
  "Deversement accidentel",
  "MP perimee en stock",
  "Contamination",
  "Erreur de preparation",
  "Pate jetee apres production",
  "Autre",
];

// ─── Enregistrer une perte produit fini ──────────────────────────────────────

export async function createPerteProduit(companyId: string, data: CreatePerteProduitInput) {
  const produit = await prisma.produit.findFirst({
    where: { id: data.produitId, companyId, actif: true },
    include: {
      recette: { include: { ingredients: { include: { mp: true, unite: true } } } },
    },
  });
  if (!produit) throw new AppError("Produit introuvable", 404);

  const valeur = Math.round(data.quantite * produit.prixVente * 100) / 100;

  const perte = await prisma.perte.create({
    data: {
      companyId,
      type:      "PRODUIT_FINI",
      produitId: data.produitId,
      quantite:  data.quantite,
      valeur,
      cause:     data.cause,
      deductMP:  data.deductMP,
      date:      data.date ? new Date(data.date) : new Date(),
      notes:     data.notes,
    },
    include: { produit: { select: { nom: true, prixVente: true } } },
  });

  // Deduire les MP du stock si demande
  let impactsMP: { mpId: string; mpNom: string; quantiteADeduire: number }[] = [];
  if (data.deductMP) {
    impactsMP = await calculerImpactMPProduitPerdu(data.produitId, data.quantite);
    for (const impact of impactsMP) {
      // Verifier que la MP a son stock gere
      const mp = await prisma.matierePremiere.findUnique({ where: { id: impact.mpId } });
      if (!mp || mp.stockGere === false) continue;
      await deduireStockMP(
        impact.mpId,
        impact.quantiteADeduire,
        "SORTIE_PERTE_PRODUIT",
        `Perte produit : ${produit.nom} x${data.quantite} (${data.cause})`
      );
    }
  }

  return {
    perte,
    valeur,
    impactsMP,
    message: data.deductMP
      ? `Perte enregistree. ${impactsMP.length} matiere(s) premiere(s) deduites du stock.`
      : "Perte enregistree. Aucune deduction de stock MP.",
  };
}

// ─── Enregistrer une perte MP ─────────────────────────────────────────────────

export async function createPerteMP(companyId: string, data: CreatePerteMPInput) {
  const mp = await prisma.matierePremiere.findFirst({
    where: { id: data.mpId, companyId, actif: true },
    include: { unite: true },
  });
  if (!mp) throw new AppError("Matiere premiere introuvable", 404);

  // Valeur = 0 si MP non geree (eau, sel...)
  const nonGeree = mp.stockGere === false;
  const valeur   = nonGeree ? 0 : Math.round(data.quantite * mp.prixAchat * 100) / 100;

  const perte = await prisma.perte.create({
    data: {
      companyId,
      type:     "MATIERE_PREMIERE",
      mpId:     data.mpId,
      quantite: data.quantite,
      valeur,
      cause:    data.cause,
      deductMP: !nonGeree,
      date:     data.date ? new Date(data.date) : new Date(),
      notes:    data.notes,
    },
    include: { mp: { select: { nom: true, prixAchat: true } } },
  });

  // Deduire du stock uniquement si gere
  if (!nonGeree) {
    await deduireStockMP(
      data.mpId,
      data.quantite,
      "SORTIE_PERTE_MP",
      `Perte MP : ${mp.nom} x${data.quantite} (${data.cause})`
    );
  }

  return {
    perte,
    valeur,
    message: nonGeree
      ? `Perte enregistree (stock non gere — aucune deduction).`
      : `Perte de ${data.quantite} ${mp.unite?.abreviation ?? ""} de ${mp.nom} enregistree. Stock mis a jour.`,
  };
}

// ─── Lister et analyser les pertes ───────────────────────────────────────────

export async function getPertes(
  companyId: string,
  options: {
    type?:      "PRODUIT_FINI" | "MATIERE_PREMIERE";
    cause?:     string;
    dateDebut?: string;
    dateFin?:   string;
    limit?:     number;
  } = {}
) {
  const { type, cause, dateDebut, dateFin, limit = 200 } = options;

  const where: any = {
    companyId,
    ...(type  ? { type  } : {}),
    ...(cause ? { cause } : {}),
    ...(dateDebut || dateFin ? {
      date: {
        ...(dateDebut ? { gte: new Date(dateDebut)                           } : {}),
        ...(dateFin   ? { lte: new Date(new Date(dateFin).setHours(23,59,59)) } : {}),
      },
    } : {}),
  };

  const pertes = await prisma.perte.findMany({
    where,
    include: {
      produit: { select: { nom: true, prixVente: true } },
      mp:      { select: { nom: true, prixAchat: true } },
    },
    orderBy: { date: "desc" },
    take: limit,
  });

  // Stats globales
  const totalProduits = pertes.filter(p => p.type === "PRODUIT_FINI").reduce((s, p) => s + p.valeur, 0);
  const totalMP       = pertes.filter(p => p.type === "MATIERE_PREMIERE").reduce((s, p) => s + p.valeur, 0);

  // Top 5 causes
  const parCause = new Map<string, { cause: string; count: number; valeur: number }>();
  for (const p of pertes) {
    const ex = parCause.get(p.cause);
    if (ex) { ex.count++; ex.valeur += p.valeur; }
    else parCause.set(p.cause, { cause: p.cause, count: 1, valeur: p.valeur });
  }
  const topCauses = Array.from(parCause.values())
    .sort((a, b) => b.valeur - a.valeur)
    .slice(0, 5);

  // Pertes par jour (7 derniers jours)
  const sept = new Date(); sept.setDate(sept.getDate() - 6);
  const pertesRecentes = await prisma.perte.findMany({
    where: { companyId, date: { gte: sept } },
    select: { date: true, valeur: true },
  });
  const parJour: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    parJour[d.toISOString().split("T")[0]] = 0;
  }
  for (const p of pertesRecentes) {
    const key = new Date(p.date).toISOString().split("T")[0];
    if (parJour[key] !== undefined) parJour[key] += p.valeur;
  }

  // Stats du mois en cours
  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const pertesMois = await prisma.perte.aggregate({
    where: { companyId, date: { gte: debutMois } },
    _sum:   { valeur: true },
    _count: true,
  });

  // Produit le plus souvent perdu
  const parProduit = new Map<string, { nom: string; count: number; valeur: number }>();
  for (const p of pertes.filter(p => p.type === "PRODUIT_FINI")) {
    const nom = p.produit?.nom ?? "Inconnu";
    const ex  = parProduit.get(nom);
    if (ex) { ex.count += p.quantite; ex.valeur += p.valeur; }
    else parProduit.set(nom, { nom, count: p.quantite, valeur: p.valeur });
  }
  const topProduitPerdu = Array.from(parProduit.values())
    .sort((a, b) => b.valeur - a.valeur)[0] ?? null;

  return {
    pertes,
    stats: {
      totalValeurProduits: Math.round(totalProduits),
      totalValeurMP:       Math.round(totalMP),
      totalValeur:         Math.round(totalProduits + totalMP),
      nbPertes:            pertes.length,
      topCauses,
      parJour,
      topProduitPerdu,
      mois: {
        valeur: Math.round(pertesMois._sum.valeur ?? 0),
        count:  pertesMois._count,
      },
    },
  };
}
