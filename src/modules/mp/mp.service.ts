// ═══════════════════════════════════════════════════════════════
// src/modules/matieresPremières/mp.service.ts
// Logique métier pour les matières premières
// ═══════════════════════════════════════════════════════════════

import { z } from "zod";
import prisma from "../../config/database";
import { AppError } from "../../middleware/error.middleware";

// ─── Schémas de validation ────────────────────────────────────
export const createMPSchema = z.object({
  nom: z.string().min(2, "Nom requis"),
  prixAchat: z.number().positive("Le prix doit être positif"),
  stockActuel: z.number().min(0).default(0),
  seuilAlerte: z.number().min(0, "Le seuil doit être positif ou zéro"),
  categorieId: z.string().optional(),
  uniteId: z.string().optional(),
  fournisseurId: z.string().optional(),
});

export const updateMPSchema = createMPSchema.partial(); // Tous les champs optionnels pour la mise à jour

export const entreeStockSchema = z.object({
  mpId: z.string(),
  quantite: z.number().positive("La quantité doit être positive"),
  motif: z.string().optional(),
});

export type CreateMPInput = z.infer<typeof createMPSchema>;
export type UpdateMPInput = z.infer<typeof updateMPSchema>;
export type EntreeStockInput = z.infer<typeof entreeStockSchema>;

// ─── Lister toutes les MP d'une entreprise ──────────────────────
export async function getMPList(companyId: string) {
  const mps = await prisma.matierePremiere.findMany({
    where: {
      companyId,
      actif: true, // Ne pas afficher les MP désactivées
    },
    include: {
      categorie: { select: { id: true, nom: true } },
      unite: { select: { id: true, nom: true, abreviation: true } },
      fournisseur: { select: { id: true, nom: true } },
    },
    orderBy: { nom: "asc" }, // Trier par nom alphabétique
  });

  // Ajouter une indication de statut pour chaque MP
  return mps.map((mp) => ({
    ...mp,
    // Statut calculé à partir du stock et du seuil
    statut:
      mp.stockActuel === 0
        ? "RUPTURE"
        : mp.stockActuel <= mp.seuilAlerte
        ? "CRITIQUE"
        : mp.stockActuel <= mp.seuilAlerte * 1.5
        ? "BAS"
        : "OK",
  }));
}

// ─── Créer une nouvelle MP ──────────────────────────────────────
export async function createMP(companyId: string, data: CreateMPInput) {
  // Vérifier qu'une MP avec le même nom n'existe pas déjà pour cette entreprise
  const existing = await prisma.matierePremiere.findFirst({
    where: { nom: data.nom, companyId, actif: true },
  });

  if (existing) {
    throw new AppError(`Une matière première "${data.nom}" existe déjà`, 409);
  }

  const mp = await prisma.matierePremiere.create({
    data: {
      ...data,
      companyId,
    },
    include: {
      categorie: true,
      unite: true,
      fournisseur: true,
    },
  });

  // Si un stock initial est fourni, créer un mouvement d'entrée
  if (data.stockActuel > 0) {
    await (prisma.mouvementStock.create as any)({
      data: {
        mpId: mp.id,
        type: "ENTREE_ACHAT",
        quantite: data.stockActuel,
        motif: "Stock initial à la création",
      },
    });
  }
  

  return mp;
}

// ─── Mettre à jour une MP ───────────────────────────────────────
export async function updateMP(
  mpId: string,
  companyId: string,
  data: UpdateMPInput
) {
  // Vérifier que la MP appartient bien à cette entreprise
  const mp = await prisma.matierePremiere.findFirst({
    where: { id: mpId, companyId },
  });

  if (!mp) {
    throw new AppError("Matière première introuvable", 404);
  }

  return prisma.matierePremiere.update({
    where: { id: mpId },
    data,
    include: { categorie: true, unite: true, fournisseur: true },
  });
}

// ─── Entrée de stock (livraison fournisseur) ────────────────────
export async function entreeStock(companyId: string, data: EntreeStockInput) {
  // Vérifier que la MP appartient à cette entreprise
  const mp = await prisma.matierePremiere.findFirst({
    where: { id: data.mpId, companyId },
  });

  if (!mp) {
    throw new AppError("Matière première introuvable", 404);
  }

  // Utiliser une transaction : mise à jour stock + création mouvement
  const result = await prisma.$transaction([
    // Incrémenter le stock
    prisma.matierePremiere.update({
      where: { id: data.mpId },
      data: { stockActuel: { increment: data.quantite } },
    }),
    // Créer le mouvement de stock pour la traçabilité
    (prisma.mouvementStock.create as any)({
      data: {
        mpId: data.mpId,
        type: "ENTREE_ACHAT",
      
        quantite: data.quantite,
        motif: data.motif ?? "Livraison fournisseur",
      },
    }),
  ]);

  return result[0]; // Retourner la MP mise à jour
}

// ─── Supprimer une MP (soft delete) ────────────────────────────
// On ne supprime jamais vraiment en BDD (besoin de l'historique).
// On désactive juste la MP avec actif = false.
export async function deleteMP(mpId: string, companyId: string) {
  const mp = await prisma.matierePremiere.findFirst({
    where: { id: mpId, companyId },
  });

  if (!mp) throw new AppError("Matière première introuvable", 404);

  return prisma.matierePremiere.update({
    where: { id: mpId },
    data: { actif: false },
  });
}

// ─── Historique des mouvements d'une MP ─────────────────────────
export async function getMouvementsStock(mpId: string, companyId: string) {
  // Vérifier l'appartenance
  const mp = await prisma.matierePremiere.findFirst({
    where: { id: mpId, companyId },
  });
  if (!mp) throw new AppError("Matière première introuvable", 404);

  return prisma.mouvementStock.findMany({
    where: { mpId },
    orderBy: { createdAt: "desc" }, // Plus récent en premier
    take: 50, // Limiter à 50 mouvements
  });
}

