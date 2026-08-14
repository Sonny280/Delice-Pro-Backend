// src/modules/production/production.service.ts
//
// NOUVEAU : Création de LotStock à chaque produit enregistré
// ═══════════════════════════════════════════════════════════
//
// Quand le boulanger enregistre un pétrin, pour chaque produit fabriqué :
//   → Un LotStock est créé avec dateCreation + dateExpiration (DLV)
//   → La dateExpiration = dateCreation + dlvJours du produit
//   → Les ventes déduisent du lot le plus ancien (FIFO)
//   → À la clôture, les lots expirés sont passés en perte automatiquement

import { z } from "zod";
import prisma from "../../config/database";
import { AppError } from "../../middleware/error.middleware";
import { deduireStockMP } from "../../utils/calculations";

// ─── Schema unique : tout en une seule saisie ────────────────────────────────

export const enregistrerProductionSchema = z.object({
  recetteId:     z.string({ required_error: "La recette est requise" }),
  numeroPetrin:  z.number().int().min(1).default(1),
  sessionProd:   z.enum(["NUIT", "JOUR"]).default("NUIT"),
  nomPetrisseur: z.string().optional(),
  heureDebut:    z.string().optional(),
  heureFin:      z.string().optional(),
  categorieProd: z.enum(["BOULANGERIE", "VIENNOISERIE_PETRISSAGE", "PATISSERIE"]).default("BOULANGERIE"),
  typeProduction: z.enum(["VENTE", "COMMANDE"]).default("VENTE"),
  nomClient:     z.string().optional(),

  quantiteFarine: z.number().positive("La quantité de farine doit être positive"),
  pateRecuperee:  z.number().min(0).default(0),
  pateEffective:  z.number().min(0),

  pateRetournee:  z.number().min(0).default(0),
  pateGatee:      z.number().min(0).default(0),
  causeGatee:     z.string().optional(),
  estDernierPetrin:      z.boolean().default(false),
  pateGardee:            z.number().min(0).default(0),
  destinationPateGardee: z.enum(["recuperee_demain", "gatee"]).optional(),

  // Produits fabriqués (boulangerie / pâtisserie)
  // dlvJours est maintenant envoyé depuis le frontend pour créer le lot
  lignes: z.array(z.object({
    produitId:     z.string(),
    quantite:      z.number().int().positive(),
    poidsUnitaire: z.number().positive(),
    mettreEnStock: z.boolean().default(true),
    dlvJours:      z.number().int().min(0).default(1), // Enregistré sur le lot
  })).default([]),

  patons: z.array(z.object({
    poids: z.number().positive(),
  })).default([]),

  notes: z.string().optional(),
});

// ─── Enregistrer un pétrin complet ───────────────────────────────────────────

export async function enregistrerProduction(
  companyId: string,
  userId: string,
  data: z.infer<typeof enregistrerProductionSchema>
) {
  // 1. Charger la recette avec ingrédients
  const recette = await prisma.recette.findFirst({
    where: { id: data.recetteId, companyId },
    include: {
      ingredients: {
        include: {
          mp:    { select: { id: true, nom: true, prixAchat: true, stockActuel: true, stockGere: true } },
          unite: { select: { abreviation: true, coefficient: true } },
        },
      },
    },
  });
  if (!recette) throw new AppError("Recette introuvable", 404);

  // AJOUT : même blocage qu'en amont dans la route — filet de sécurité
  // au cas où enregistrerProduction() soit appelée autrement un jour
  // (script, autre route...) sans repasser par la vérification de
  // production.routes.ts.
  if (recette.ingredients.length === 0) {
    throw new AppError(
      `La recette "${recette.nom}" n'a aucun ingrédient enregistré. ` +
      `Impossible de lancer une production tant qu'elle n'est pas complétée ` +
      `(page Recettes → Modifier → ajouter au moins un ingrédient).`,
      400
    );
  }

  const quantiteFarine = data.quantiteFarine;

  // 2. Pâte théorique
  const pateTheorique = Math.round(
    (recette.ratioPate * quantiteFarine + data.pateRecuperee) * 100
  ) / 100;

  // 3. Alertes stock (non bloquantes)
  const alertesStock: { mp: string; stockActuel: number; besoin: number; manque: number }[] = [];
  for (const ing of recette.ingredients) {
    if (ing.mp.stockGere === false) continue;
    const coeff  = ing.unite?.coefficient ?? 1;
    const besoin = Math.round(ing.quantite * quantiteFarine * coeff * 1000) / 1000;
    if (ing.mp.stockActuel < besoin) {
      alertesStock.push({
        mp: ing.mp.nom, stockActuel: ing.mp.stockActuel,
        besoin, manque: Math.round((besoin - ing.mp.stockActuel) * 1000) / 1000,
      });
    }
  }

  // 4. Différence et écart
  // CORRIGÉ : réel − théorique (pas théorique − réel) — un manque de pâte
  // doit afficher un chiffre négatif, un surplus un chiffre positif.
  const difference = Math.round((data.pateEffective - pateTheorique) * 100) / 100;
  const ecartPct   = pateTheorique > 0
    ? Math.round((difference / pateTheorique) * 10000) / 100 : 0;

  // 5. Heures (cross-minuit géré : session nuit 22h→06h)
  const buildDt = (heureStr?: string, reference?: Date): Date | undefined => {
    if (!heureStr) return undefined;
    const [h, m] = heureStr.split(":").map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    // Si heureFin < heureDebut → session cross-minuit → +1 jour sur heureFin
    if (reference && d.getTime() < reference.getTime()) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  };

  const dtDebut = buildDt(data.heureDebut);
  const dtFin   = buildDt(data.heureFin, dtDebut);

  // RÈGLE 1 — Cohérence des restes de pâte
  // Vérifie que pâte gâtée + retournée + gardée ne dépasse pas la pâte effective
  const totalRestes = (data.pateGatee ?? 0)
    + (data.pateRetournee ?? 0)
    + (data.estDernierPetrin ? (data.pateGardee ?? 0) : 0);

  if (totalRestes > data.pateEffective + 0.01) {
    throw new AppError(
      `Incohérence pâte : gâtée (${data.pateGatee ?? 0}kg) + retournée (${data.pateRetournee ?? 0}kg)` +
      `${data.estDernierPetrin ? ` + gardée (${data.pateGardee ?? 0}kg)` : ""}` +
      ` = ${Math.round(totalRestes * 100) / 100}kg > pâte effective (${data.pateEffective}kg).`,
      400
    );
  }

  // RÈGLE 1b — AJOUT : Poids produits fabriqués vs pâte disponible (boulangerie)
  // La pâte disponible = pâte effective − pâte gâtée − pâte retournée − pâte gardée
  // Le poids total des produits ne peut pas dépasser la pâte disponible (tolérance 15%)
  if (data.categorieProd === "BOULANGERIE" && data.lignes.length > 0) {
    // Récupérer les grammages des produits depuis la base
    const produitIds = data.lignes.map((l: any) => l.produitId);
    const produits = await prisma.produit.findMany({
      where: { id: { in: produitIds } },
      select: { id: true, nom: true, grammage: true },
    });
    const prodMap = new Map(produits.map((p: any) => [p.id, p]));

    // Calculer le poids total fabriqué
    let poidsFabriqueGrammes = 0;
    const lignesSansGrammage: string[] = [];

    for (const ligne of data.lignes) {
      const prod = prodMap.get(ligne.produitId) as any;
      if (!prod) continue;
      if (!prod.grammage || prod.grammage <= 0) {
        lignesSansGrammage.push(prod.nom);
        continue;
      }
      poidsFabriqueGrammes += ligne.quantite * prod.grammage;
    }

    const pateDisponibleKg = data.pateEffective
      - (data.pateGatee ?? 0)
      - (data.pateRetournee ?? 0)
      - (data.pateGardee ?? 0);

    const poidsFabriqueKg = poidsFabriqueGrammes / 1000;
    const ecartPct = pateDisponibleKg > 0
      ? Math.abs(poidsFabriqueKg - pateDisponibleKg) / pateDisponibleKg * 100
      : 0;

    // Alerte si le poids fabriqué dépasse de plus de 20% la pâte disponible
    if (poidsFabriqueKg > pateDisponibleKg * 1.20) {
      throw new AppError(
        `Poids des produits fabriqués (${poidsFabriqueKg.toFixed(2)} kg) dépasse la pâte disponible ` +
        `(${pateDisponibleKg.toFixed(2)} kg) de ${Math.round(ecartPct)}%. ` +
        `Réduisez les quantités ou augmentez la pâte effective.`,
        400
      );
    }

    // Avertissement (pas bloquant) si écart > 10% mais < 20%
    if (lignesSansGrammage.length > 0 && produits.length > 0) {
      console.warn(
        `[Production] Produits sans grammage défini (non vérifiés) : ${lignesSansGrammage.join(", ")}`
      );
    }
  }

  // RÈGLE 2 — Viennoiserie : poids pâtons vs pâte effective (±30%)
  if (data.categorieProd === "VIENNOISERIE_PETRISSAGE" && data.patons.length > 0) {
    const totalPatons = data.patons.reduce((s: number, p: { poids: number }) => s + p.poids, 0);
    const ecartPct    = Math.abs(totalPatons - data.pateEffective) / data.pateEffective * 100;
    if (ecartPct > 30) {
      throw new AppError(
        `Poids pâtons (${Math.round(totalPatons * 100) / 100}kg) trop éloigné de la pâte effective (${data.pateEffective}kg). Écart : ${Math.round(ecartPct)}%. Max toléré : 30%.`,
        400
      );
    }
  }

 

  // 5c. Validation viennoiserie : poids pâtons vs pâte effective
  if (data.patons.length > 0) {
    const poidsTotalPatons = data.patons.reduce((s, p) => s + p.poids, 0);
    const ecartPoids = Math.abs(poidsTotalPatons - data.pateEffective) / data.pateEffective;
    if (ecartPoids > 0.20) { // > 20% d'écart → probablement une erreur
      throw new AppError(
        `Incohérence viennoiserie : poids pâtons (${Math.round(poidsTotalPatons*100)/100}kg)` +
        ` diffère de la pâte effective (${data.pateEffective}kg) de ${Math.round(ecartPoids*100)}%.` +
        ` Vérifiez le nombre ou le poids des pâtons.`,
        400
      );
    }
  }

  // 6. Créer la production (statut TERMINEE directement)
  const production = await prisma.production.create({
    data: {
      companyId, userId,
      recetteId:      data.recetteId,
      quantiteFarine, pateTheorique,
      pateEffective:  data.pateEffective,
      difference,     ecartPct,
      pateRecuperee:  data.pateRecuperee,
      pateRetournee:  data.pateRetournee,
      pateGatee:      data.pateGatee,
      causeGatee:     data.causeGatee,
      pateGardee:     data.estDernierPetrin ? data.pateGardee : 0,
      destinationPateGardee: data.estDernierPetrin ? data.destinationPateGardee : null,
      numeroPetrin:   data.numeroPetrin,
      sessionProd:    data.sessionProd,
      nomPetrisseur:  data.nomPetrisseur,
      heureDebut:     dtDebut,
      heureFin:       dtFin,
      categorieProd:  data.categorieProd,
      typeProduction: data.typeProduction,
      nomClient:      data.nomClient,
      statut:         "TERMINEE",
      dateTerminaison: new Date(),
      notes:          data.notes,
    } as any,
  });

  // 7. Déduire les MP du stock
  for (const ing of recette.ingredients) {
    if (ing.mp.stockGere === false) continue;
    const coeff = ing.unite?.coefficient ?? 1;
    const qte   = Math.round(ing.quantite * quantiteFarine * coeff * 1000) / 1000;
    await deduireStockMP(
      ing.mp.id, qte, "SORTIE_PRODUCTION",
      `Pétrin #${data.numeroPetrin} — ${recette.nom} (${quantiteFarine} kg farine)`
    );
  }

  // 8. Pertes MP pâte gâtée
  if (data.pateGatee > 0) {
    const ratioPerte = data.pateGatee / (data.pateEffective || 1);
    for (const ing of recette.ingredients) {
      if (ing.mp.stockGere === false) continue;
      const coeff  = ing.unite?.coefficient ?? 1;
      const qtePer = Math.round(ing.quantite * quantiteFarine * coeff * ratioPerte * 1000) / 1000;
      if (qtePer <= 0) continue;
      await prisma.perte.create({
        data: {
          companyId, type: "MATIERE_PREMIERE", mpId: ing.mp.id,
          quantite: qtePer,
          valeur:   Math.round(qtePer * ing.mp.prixAchat * 100) / 100,
          cause:    data.causeGatee ?? "Pâte gâtée",
          deductMP: false, date: new Date(),
          notes:    `Pétrin #${data.numeroPetrin} — ${data.pateGatee} kg gâtés`,
        },
      });
    }
  }

  // 9. Pertes MP pâte gardée → gâtée
  if (data.estDernierPetrin && data.pateGardee > 0 && data.destinationPateGardee === "gatee") {
    const ratioPerte = data.pateGardee / (data.pateEffective || 1);
    for (const ing of recette.ingredients) {
      if (ing.mp.stockGere === false) continue;
      const coeff  = ing.unite?.coefficient ?? 1;
      const qtePer = Math.round(ing.quantite * quantiteFarine * coeff * ratioPerte * 1000) / 1000;
      if (qtePer <= 0) continue;
      await prisma.perte.create({
        data: {
          companyId, type: "MATIERE_PREMIERE", mpId: ing.mp.id,
          quantite: qtePer,
          valeur:   Math.round(qtePer * ing.mp.prixAchat * 100) / 100,
          cause:    "Pâte gardée non utilisée",
          deductMP: false, date: new Date(),
        },
      });
    }
  }

  // 10. Lignes production + stock produits + LOTS STOCK
  // ════════════════════════════════════════════════════
  // NOUVEAU : pour chaque produit fabriqué, créer un LotStock
  // avec dateCreation = maintenant et dateExpiration = maintenant + dlvJours
  const maintenant = new Date();

  const lotsCreees: any[] = [];
  const lignesCreees = await Promise.all(
    data.lignes.map(async l => {
      const poidsTotal = Math.round(l.quantite * l.poidsUnitaire / 1000 * 1000) / 1000;

      // Récupérer le dlvJours du produit si non fourni par le frontend
      let dlvJours = l.dlvJours;
      if (dlvJours === undefined || dlvJours === null) {
        const prod = await prisma.produit.findUnique({
          where: { id: l.produitId },
          select: { dlvJours: true },
        });
        dlvJours = prod?.dlvJours ?? 1;
      }

      // Calculer la date d'expiration
      // DLV en jours → on ajoute dlvJours × 24h à la date de production
      const dateExpiration = new Date(maintenant);
      dateExpiration.setHours(dateExpiration.getHours() + dlvJours * 24);

      // Mettre à jour le stock global (inchangé)
      if (l.mettreEnStock) {
        await prisma.produit.update({
          where: { id: l.produitId },
          data:  { stockActuel: { increment: l.quantite } },
        });
      }

      // NOUVEAU : Créer le lot de stock avec traçabilité DLV
      if (l.mettreEnStock && dlvJours >= 0) {
        const lot = await (prisma as any).lotStock.create({
          data: {
            companyId,
            produitId:       l.produitId,
            productionId:    production.id,
            quantiteInitiale: l.quantite,
            quantiteRestante: l.quantite,
            dateCreation:    maintenant,
            dateExpiration,
            dlvJours,
            statut:          "ACTIF",
          },
        });
        lotsCreees.push(lot);
      }

      // Créer la ligne de production (inchangé)
      return prisma.ligneProduction.create({
        data: {
          productionId:  production.id,
          produitId:     l.produitId,
          quantite:      l.quantite,
          poidsUnitaire: l.poidsUnitaire,
          poidsTotal,
        } as any,
      });
    })
  );

  // 11. Pâtons viennoiserie → chambre froide
  // OPTIMISATION : createMany au lieu de N Promise.all (beaucoup plus rapide pour 500 pâtons)
  let patonsCreees: any[] = [];
  if (data.patons.length > 0) {
    // Pâtons >= 1kg → suivi individuel (rendement façonnage, perte individuelle)
    // Pâtons < 1kg → on crée quand même chaque entrée mais via createMany groupé
    const SEUIL_GROUPE = 0; // Tous les pâtons via createMany

    // Grouper par poids pour optimiser
    const groupes = data.patons.reduce((acc: Record<string, number>, p) => {
      const key = String(p.poids);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    // Créer en batch par groupe de poids identique
    for (const [poids, count] of Object.entries(groupes)) {
      const poidsNum = Number(poids);
      await prisma.paton.createMany({
        data: Array.from({ length: count }, () => ({
          companyId,
          productionId: production.id,
          poids:        poidsNum,
          statutPaton:  "EN_CHAMBRE_FROIDE",
          createdAt:    new Date(),
        })) as any[],
      });
    }

    // Récupérer les IDs créés pour le retour
    patonsCreees = await prisma.paton.findMany({
      where:   { productionId: production.id },
      select:  { id: true, poids: true, statutPaton: true },
    }) as any[];
  }

  const totalPieces = data.lignes.reduce((s, l) => s + l.quantite, 0);

  // Alerte responsable si écart > 10%
  const alerteEcart = Math.abs(ecartPct) > 10 ? {
    niveau:  "CRITIQUE",
    message: `Écart pâte anormal : ${ecartPct > 0 ? "+" : ""}${ecartPct}% (seuil : ±10%). Vérifier la pesée et la recette.`,
    ecartPct,
    difference,
  } : Math.abs(ecartPct) > 5 ? {
    niveau:  "ATTENTION",
    message: `Écart pâte élevé : ${ecartPct > 0 ? "+" : ""}${ecartPct}% (seuil recommandé : ±5%).`,
    ecartPct,
    difference,
  } : null;

  return {
    production:    { ...production, difference, ecartPct },
    pateTheorique,
    pateEffective: data.pateEffective,
    difference,    ecartPct,
    totalPieces,
    nbPatons:      data.patons.length,
    nbLots:        lotsCreees.length,
    alertesStock,
    alerteEcart,  // null = OK | ATTENTION | CRITIQUE
    // Retourner les lots créés pour affichage dans le frontend
    lots: lotsCreees.map(lot => ({
      produitId:      lot.produitId,
      quantite:       lot.quantiteInitiale,
      dateCreation:   lot.dateCreation,
      dateExpiration: lot.dateExpiration,
      dlvJours:       lot.dlvJours,
    })),
    message: [
      `Pétrin #${data.numeroPetrin} enregistré.`,
      totalPieces > 0    ? `${totalPieces} pièces fabriquées.` : "",
      lotsCreees.length > 0 ? `${lotsCreees.length} lot(s) DLV créés.` : "",
      data.patons.length > 0 ? `${data.patons.length} pâtons en chambre froide.` : "",
      `Pâte effective : ${data.pateEffective} kg. Différence : ${difference > 0 ? "+" : ""}${difference} kg (${ecartPct}%).`,
      data.pateRetournee > 0 ? `Pâte retournée : ${data.pateRetournee} kg.` : "",
      data.pateGatee > 0     ? `Pâte gâtée : ${data.pateGatee} kg → pertes MP enregistrées.` : "",
    ].filter(Boolean).join(" "),
  };
}

// ─── Façonner un pâton ────────────────────────────────────────────────────────

export const faconnerPatonSchema = z.object({
  patonId:     z.string(),
  produitId:   z.string(),
  poidsBeurre: z.number().min(0).default(0),
  beurreMP:    z.string().optional(), // ID de la MP beurre utilisée (Beurre Corman, Patisy...)
  nbPieces:    z.number().int().positive(),
  notes:       z.string().optional(),
});

export async function faconnerPaton(
  companyId: string,
  data: z.infer<typeof faconnerPatonSchema>
) {
  const paton = await prisma.paton.findFirst({
    where: { id: data.patonId, companyId, statutPaton: "EN_CHAMBRE_FROIDE" },
  });
  if (!paton) throw new AppError("Pâton introuvable ou déjà façonné", 404);

  const poidsTotal = Math.round((paton.poids + data.poidsBeurre) * 100) / 100;
  const rendement  = Math.round((data.nbPieces / poidsTotal) * 100) / 100;

  await prisma.paton.update({
    where: { id: data.patonId },
    data: {
      poidsBeurre:   data.poidsBeurre,
      poidsTotal,
      nbPieces:      data.nbPieces,
      rendement,
      produitId:     data.produitId,
      statutPaton:   "FACONNE",
      dateFaconnage: new Date(),
    } as any,
  });

  // Mettre à jour le stock du produit viennoiserie
  await prisma.produit.update({
    where: { id: data.produitId },
    data:  { stockActuel: { increment: data.nbPieces } },
  });

  // Déduire le beurre/matière grasse du stock MP si spécifié
  if (data.beurreMP && data.poidsBeurre > 0) {
    const beurre = await prisma.matierePremiere.findFirst({
      where: { id: data.beurreMP, companyId },
    });
    if (beurre && beurre.stockGere) {
      await deduireStockMP(
        data.beurreMP,
        data.poidsBeurre,
        "SORTIE_PRODUCTION",
        `Façonnage pâton → ${data.nbPieces} pièces`
      );
    }
  }

  // NOUVEAU : Créer un lot DLV pour les pièces de viennoiserie façonnées
  // Le DLV de la viennoiserie est en général 1 jour (vendu le jour même)
  const produit = await prisma.produit.findUnique({
    where: { id: data.produitId },
    select: { nom: true, dlvJours: true, companyId: true },
  });

  const maintenant = new Date();
  const dlvJours   = produit?.dlvJours ?? 1;
  const dateExpiration = new Date(maintenant);
  dateExpiration.setHours(dateExpiration.getHours() + dlvJours * 24);

  await (prisma as any).lotStock.create({
    data: {
      companyId,
      produitId:        data.produitId,
      quantiteInitiale: data.nbPieces,
      quantiteRestante: data.nbPieces,
      dateCreation:     maintenant,
      dateExpiration,
      dlvJours,
      statut:           "ACTIF",
      notesExpiration:  `Façonné depuis pâton ${paton.poids} kg`,
    },
  });

  return {
    rendement,
    dlvJours,
    dateExpiration,
    message: `Pâton façonné : ${data.nbPieces} "${produit?.nom}". Rendement : ${rendement} pcs/kg. DLV : ${dlvJours}j (expire ${dateExpiration.toLocaleDateString("fr-FR")}).`,
  };
}

// ─── Lots en cours (pour la page stocks) ─────────────────────────────────────

export async function getLotsActifs(companyId: string, produitId?: string) {
  const maintenant = new Date();
  const lots = await (prisma as any).lotStock.findMany({
    where: {
      companyId,
      statut:          "ACTIF",
      quantiteRestante: { gt: 0 },
      ...(produitId ? { produitId } : {}),
    },
    include: {
      produit:    { select: { nom: true, prixVente: true } },
      production: { select: { numeroPetrin: true, date: true } },
    },
    orderBy: { dateExpiration: "asc" },
  });

  return lots.map((lot: any) => {
    const heuresRestantes = Math.max(0,
      Math.round((new Date(lot.dateExpiration).getTime() - maintenant.getTime()) / (1000 * 60 * 60))
    );
    return {
      ...lot,
      heuresRestantes,
      estUrgent: heuresRestantes < 4,  // Moins de 4h → rouge
      estProche: heuresRestantes < 12, // Moins de 12h → orange
    };
  });
}

// ─── Pâtons en chambre froide ─────────────────────────────────────────────────

export async function getPatonsEnChambreFroide(companyId: string) {
  const patons = await prisma.paton.findMany({
    where:   { companyId, statutPaton: "EN_CHAMBRE_FROIDE" },
    include: {
      production: {
        select: {
          id: true, date: true,
          numeroPetrin: true, sessionProd: true,
          recette: { select: { nom: true } },
        },
      },
      produit: { select: { id: true, nom: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return patons.map((p: any) => ({
    ...p,
    ageHeures: Math.floor((Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60)),
    alerteAge: Math.floor((Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60)) >= 24
      ? "URGENT" : Math.floor((Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60)) >= 20
      ? "ATTENTION" : "OK",
  }));
}

// ─── Dernière pâte retournée ──────────────────────────────────────────────────

export async function getDerniereRetournee(companyId: string) {
  const il_y_a_36h = new Date(Date.now() - 36 * 60 * 60 * 1000);

  // Chercher le dernier pétrin avec de la pâte retournée
  const candidat = await prisma.production.findFirst({
    where: {
      companyId, date: { gte: il_y_a_36h }, statut: "TERMINEE",
      pateRetournee: { gt: 0 },
    } as any,
    orderBy: { numeroPetrin: "desc" },
    select: {
      id: true, numeroPetrin: true, pateRetournee: true, date: true,
      recette: { select: { nom: true } },
    } as any,
  });

  if (!candidat) return null;

  // CORRECTION BUG 2 : Vérifier qu'aucun pétrin postérieur n'a déjà
  // récupéré cette pâte (pateRecuperee > 0 après la date du candidat)
  const dejaRecuperee = await prisma.production.findFirst({
    where: {
      companyId,
      statut:       "TERMINEE",
      date:         { gt: (candidat as any).date },
      pateRecuperee: { gt: 0 },
    } as any,
  });

  // Si un pétrin postérieur a déjà récupéré de la pâte → ne plus afficher l'alerte
  if (dejaRecuperee) return null;

  return candidat;
}

// ─── Prochain numéro de pétrin ───────────────────────────────────────────────
// Retourne le numéro suggéré = dernier pétrin du jour + 1

export async function getProchainNumeroPetrin(companyId: string): Promise<number> {
  const debutJour = new Date();
  debutJour.setHours(0, 0, 0, 0);

  const dernier = await prisma.production.findFirst({
    where: {
      companyId,
      date:   { gte: debutJour },
      statut: "TERMINEE",
    } as any,
    orderBy: { numeroPetrin: "desc" },
    select: { numeroPetrin: true },
  });

  return (dernier?.numeroPetrin ?? 0) + 1;
}

// ─── Historique des productions ───────────────────────────────────────────────

export async function getProductions(companyId: string, options: {
  categorieProd?: string; sessionProd?: string;
  dateDebut?: string; dateFin?: string;
} = {}) {
  return prisma.production.findMany({
    where: {
      companyId,
      ...(options.categorieProd ? { categorieProd: options.categorieProd as any } : {}),
      ...(options.sessionProd   ? { sessionProd: options.sessionProd } : {}),
      ...(options.dateDebut || options.dateFin ? {
        date: {
          ...(options.dateDebut ? { gte: new Date(options.dateDebut) } : {}),
          ...(options.dateFin   ? { lte: new Date(new Date(options.dateFin).setHours(23,59,59)) } : {}),
        },
      } : {}),
    },
    include: {
      recette:  { select: { id: true, nom: true, ratioPate: true } },
      user:     { select: { prenom: true, nom: true } },
      patons:   { select: { id: true, poids: true, statutPaton: true, nbPieces: true, rendement: true } },
      lignesProduction: { include: { produit: { select: { nom: true } } } },
      
    },
    orderBy: [{ date: "desc" }, { numeroPetrin: "asc" }],
    take: 150,
  });
}

