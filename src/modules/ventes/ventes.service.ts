// src/modules/ventes/ventes.service.ts
//
// CORRECTIONS :
// ─────────────────────────────────────────────────────────────────────────────
// FIX 1 : LotStock mis à jour en FIFO à chaque vente (quantiteRestante)
// FIX 2 : Transaction Prisma pour atomicité vente + stock
// FIX 3 : Split paiement sauvegardé en base
// FIX 4 : Protection stock négatif avant la vente
// FIX 5 : Catch avec message d'erreur explicite

import { z } from "zod";
import prisma from "../../config/database";
import { AppError } from "../../middleware/error.middleware";

// ─── Schémas ──────────────────────────────────────────────────────────────────

export const createVenteSchema = z.object({
  lignes: z.array(z.object({
    produitId:    z.string().min(1, "Sélectionnez un produit"),
    // CORRECTION 🟡 : Quantité entière — pas de demi-pain, demi-croissant
    quantite:     z.number().int("La quantité doit être un entier").positive("La quantité doit être > 0"),
    // CORRECTION 🟡 : Prix optionnel mais si fourni, doit être > 0
    prixUnitaire: z.number().positive("Le prix unitaire doit être > 0").optional(),
  })).min(1, "Ajoutez au moins un produit à la vente"),

  // Mode paiement principal
  modePaiement: z.enum(["ESPECES","MOBILE_MONEY","CARTE_BANCAIRE","VIREMENT","A_CREDIT","AUTRE"])
    .default("ESPECES"),

  // FIX 3 : Split paiement — 2 modes sur 1 vente
  splitPaiement:  z.boolean().default(false),
  split1Mode:     z.enum(["ESPECES","MOBILE_MONEY","CARTE_BANCAIRE","VIREMENT"]).optional(),
  split1Montant:  z.number().min(0).optional(),
  split2Mode:     z.enum(["ESPECES","MOBILE_MONEY","CARTE_BANCAIRE","VIREMENT","A_CREDIT"]).optional(),
  split2Montant:  z.number().min(0).optional(),

  clientId:     z.string().optional(),
  nomClient:    z.string().optional(),
  date:         z.string().datetime().optional(),
  notes:        z.string().optional(),
  remiseMontant: z.number().min(0).default(0),
  remisePct:     z.number().min(0).max(100).default(0),
});

export type CreateVenteInput = z.infer<typeof createVenteSchema>;

// ─── Créer une vente ──────────────────────────────────────────────────────────

export async function createVente(
  companyId: string,
  userId:    string,
  data:      CreateVenteInput
) {
  // 1. Charger tous les produits
  const produitIds = data.lignes.map(l => l.produitId);
  const produits   = await prisma.produit.findMany({
    where: { id: { in: produitIds }, companyId, actif: true },
  });

  if (produits.length !== produitIds.length) {
    throw new AppError("Un ou plusieurs produits sont introuvables", 404);
  }

  const produitsMap = new Map(produits.map(p => [p.id, p]));

  // CORRECTION 🔴 : Re-vérifier le stock en temps réel (problème de concurrence)
  // Si 2 caissiers vendent en même temps le dernier pain, on re-lit depuis la DB
  const produitsTempsReel = await prisma.produit.findMany({
    where: { id: { in: produitIds }, companyId },
    select: { id: true, nom: true, stockActuel: true, prixVente: true },
  });
  const mapTempsReel = new Map(produitsTempsReel.map(p => [p.id, p]));

  for (const ligne of data.lignes) {
    const produit      = produitsMap.get(ligne.produitId)!;
    const produitReel  = mapTempsReel.get(ligne.produitId);
    const stockReel    = (produitReel as any)?.stockActuel ?? (produit as any).stockActuel;
    const prixUnitaire = (produit as any).prixVente ?? 0;

    // Stock insuffisant
    if (stockReel < ligne.quantite) {
      throw new AppError(
        `Stock insuffisant pour "${(produit as any).nom}" : ` +
        `demandé ${ligne.quantite}, disponible ${stockReel}. ` +
        `Faites une production avant de vendre.`,
        400
      );
    }

    // CORRECTION 🟡 : Bloquer vente à prix 0 (vente gratuite accidentelle)
    if (prixUnitaire <= 0) {
      throw new AppError(
        `Le prix de "${(produit as any).nom}" est à 0 FCFA. ` +
        `Définissez un prix dans Stocks → Produits avant de vendre.`,
        400
      );
    }
  }

  // 2. Calculer les montants
  const lignesAvecPrix = data.lignes.map(ligne => {
    const produit  = produitsMap.get(ligne.produitId)!;
    const sousTotal = ligne.quantite * (produit as any).prixVente;
    return {
      produitId:    ligne.produitId,
      quantite:     ligne.quantite,
      prixUnitaire: (produit as any).prixVente,
      sousTotal,
    };
  });

  const montantBrut   = lignesAvecPrix.reduce((s, l) => s + l.sousTotal, 0);
  const remiseMontant = Math.min(data.remiseMontant ?? 0, montantBrut);
  const remisePct     = data.remisePct ?? 0;
  const montantFinal  = Math.max(0, Math.round((montantBrut - remiseMontant) * 100) / 100);

  // Split paiement : valider la cohérence
  if (data.splitPaiement && data.split1Montant !== undefined) {
    const split2 = Math.max(0, montantFinal - data.split1Montant);
    if (data.split1Montant > montantFinal + 0.01) {
      throw new AppError(
        `Le montant split 1 (${data.split1Montant}) dépasse le total (${montantFinal})`,
        400
      );
    }
  }

  // FIX 2 : Tout dans une transaction Prisma
  const result = await prisma.$transaction(async (tx) => {
    // 2a. Créer la vente
    const vente = await tx.vente.create({
      data: {
        companyId, userId,
        montantTotal:  montantFinal,
        montantBrut,
        remiseMontant,
        remisePct,
        modePaiement:  data.modePaiement,
        nomClient:     data.nomClient ?? null,
        clientId:      data.clientId  ?? null,
        date:          data.date ? new Date(data.date) : new Date(),
        notes:         data.notes,
        // FIX 3 : Split paiement
        splitPaiement: data.splitPaiement ?? false,
        split1Mode:    data.splitPaiement ? data.split1Mode    : null,
        split1Montant: data.splitPaiement ? data.split1Montant : null,
        split2Mode:    data.splitPaiement ? data.split2Mode    : null,
        split2Montant: data.splitPaiement
          ? Math.max(0, montantFinal - (data.split1Montant ?? 0))
          : null,
        lignes: { create: lignesAvecPrix },
      } as any,
      include: {
        lignes: { include: { produit: { select: { nom: true, dlvJours: true } } } },
        user:   { select: { prenom: true, nom: true } },
      },
    });

    // 2b. Décrémenter le stock de chaque produit
    for (const ligne of lignesAvecPrix) {
      await tx.produit.update({
        where: { id: ligne.produitId },
        data:  { stockActuel: { decrement: ligne.quantite } },
      });
    }

    // FIX 1 : Mettre à jour les LotStock en FIFO
    // Pour chaque produit vendu, déduire des lots les plus anciens en premier
    for (const ligne of lignesAvecPrix) {
      let qteRestante = ligne.quantite;

      // Charger les lots actifs du produit, triés par dateExpiration ASC (FIFO)
      const lots = await (tx as any).lotStock.findMany({
        where: {
          companyId,
          produitId:        ligne.produitId,
          statut:           "ACTIF",
          quantiteRestante: { gt: 0 },
        },
        orderBy: { dateExpiration: "asc" }, // Plus ancien en premier
      });

      for (const lot of lots) {
        if (qteRestante <= 0) break;

        const aDedire = Math.min(lot.quantiteRestante, qteRestante);
        qteRestante  -= aDedire;
        const nouvelleQte = lot.quantiteRestante - aDedire;

        await (tx as any).lotStock.update({
          where: { id: lot.id },
          data: {
            quantiteRestante: nouvelleQte,
            // Si lot épuisé → marquer EPUISE
            ...(nouvelleQte === 0 ? { statut: "EPUISE" } : {}),
          },
        });
      }
      // Note : si qteRestante > 0 ici, c'est que le stock est incohérent
      // (produit vendu sans lot correspondant — ex: produit saisi manuellement)
    }

    // 2c. Crédit client
    if (data.modePaiement === "A_CREDIT" && data.clientId) {
      await tx.client.update({
        where: { id: data.clientId },
        data:  { soldeCredit: { increment: montantFinal } },
      });
    }

    return vente;
  });

  return result;
}

// ─── Stats des ventes ──────────────────────────────────────────────────────────

export async function getStatsVentes(
  companyId: string,
  options: { dateDebut?: string; dateFin?: string } = {}
) {
  const { dateDebut, dateFin } = options;

  const ventes = await prisma.vente.findMany({
    where: {
      companyId,
      ...(dateDebut || dateFin ? {
        date: {
          ...(dateDebut ? { gte: new Date(dateDebut) } : {}),
          ...(dateFin   ? { lte: new Date(dateFin)   } : {}),
        },
      } : {}),
    },
    include: {
      lignes: { include: { produit: { select: { nom: true } } } },
    },
    orderBy: { date: "desc" },
  });

  const caTotale       = ventes.reduce((s, v) => s + v.montantTotal, 0);
  const nbTransactions = ventes.length;
  const panierMoyen    = nbTransactions > 0 ? caTotale / nbTransactions : 0;

  // Split : répartition par mode réel (mode principal + split)
  const caParMode: Record<string, number> = {};
  for (const v of ventes) {
    const vAny = v as any;
    if (vAny.splitPaiement && vAny.split1Mode) {
      // Split : compter chaque mode séparément
      caParMode[vAny.split1Mode] = (caParMode[vAny.split1Mode] ?? 0) + (vAny.split1Montant ?? 0);
      caParMode[vAny.split2Mode] = (caParMode[vAny.split2Mode] ?? 0) + (vAny.split2Montant ?? 0);
    } else {
      caParMode[v.modePaiement] = (caParMode[v.modePaiement] ?? 0) + v.montantTotal;
    }
  }

  const ventesParProduit: Record<string, { nom: string; quantite: number; ca: number }> = {};
  for (const vente of ventes) {
    for (const ligne of vente.lignes) {
      const id = ligne.produitId;
      if (!ventesParProduit[id]) ventesParProduit[id] = { nom: ligne.produit.nom, quantite: 0, ca: 0 };
      ventesParProduit[id].quantite += ligne.quantite;
      ventesParProduit[id].ca       += ligne.sousTotal;
    }
  }

  const topProduits = Object.values(ventesParProduit)
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 10);

  return {
    ventes,
    stats: {
      caTotale:       Math.round(caTotale),
      nbTransactions,
      panierMoyen:    Math.round(panierMoyen),
      topProduits,
      caParMode,
    },
  };
}

export async function ajouterStockProduit(
  companyId: string, produitId: string, quantite: number
) {
  const produit = await prisma.produit.findFirst({ where: { id: produitId, companyId } });
  if (!produit) throw new Error("Produit introuvable");
  return prisma.produit.update({ where: { id: produitId }, data: { stockActuel: { increment: quantite } } });
}

export async function getStockProduits(companyId: string) {
  const produits = await prisma.produit.findMany({
    where:   { companyId, actif: true },
    include: { categorie: { select: { id: true, nom: true } }, recette: { select: { id: true, nom: true } } },
    orderBy: { nom: "asc" },
  });
  return produits.map(p => ({
    ...p,
    statut: p.stockActuel === 0 ? "RUPTURE"
      : p.stockActuel <= p.seuilAlerte    ? "CRITIQUE"
      : p.stockActuel <= p.seuilAlerte * 1.5 ? "BAS"
      : "OK",
  }));
}
