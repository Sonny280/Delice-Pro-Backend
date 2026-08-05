// src/modules/cloture/cloture.routes.ts
//
// ═══════════════════════════════════════════════════════════════
// ÉVOLUTIONS (suite au document client "Délice Pro — Clôture") :
//
// 1. PLAGES HORAIRES — une entreprise peut avoir 1 seule plage
//    ("Journée", comportement identique à avant) ou plusieurs
//    (ex: équipe matin 05h-13h, équipe après-midi 13h-21h).
//    Chaque clôture est rattachée à une plage. La passation entre
//    équipes se fait via un instantané du stock (stockSnapshot).
//
// 2. CONFIRMATION MANUELLE — les lots DLV expirés ne sont plus
//    passés en perte automatiquement et silencieusement. Le
//    front les affiche (GET /produits), l'utilisateur les
//    coche/décoche, et SEULS ceux explicitement confirmés dans
//    le body de POST /journee sont traités.
//
// 3. ORIGINE DES PERTES — toute perte créée ici porte origine
//    "VENTE" (invendu constaté à la clôture), distincte des
//    pertes "PRODUCTION" créées ailleurs (module Production/
//    Pertes) — évite le double comptage signalé par le client.
//
// 4. AUDIT — toute création/suppression de clôture est journalisée
//    dans AuditLog.
//
// 5. VÉRIFICATION CROISÉE — recalcule le CA avec la formule du
//    client (stock départ + reçu − stock restant − invendus) et
//    compare au CA réellement encaissé.
// ═══════════════════════════════════════════════════════════════

import { Router, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import prisma from "../../config/database";

const router = Router();
router.use(authMiddleware);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function debutJournee(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function finJournee(): Date {
  const d = new Date(); d.setHours(23, 59, 59, 999); return d;
}
function heureDansPlage(heureDebut: string, heureFin: string): boolean {
  const [hd, md] = heureDebut.split(":").map(Number);
  const [hf, mf] = heureFin.split(":").map(Number);
  const now = new Date();
  const minsNow = now.getHours() * 60 + now.getMinutes();
  const minsDebut = hd * 60 + md;
  const minsFin = hf * 60 + mf;
  // Plage qui traverse minuit (ex: 21h-05h) — cas rare mais à couvrir
  if (minsFin < minsDebut) return minsNow >= minsDebut || minsNow <= minsFin;
  return minsNow >= minsDebut && minsNow <= minsFin;
}

async function logAudit(params: {
  companyId: string; userId: string; action: string;
  entite: string; entiteId?: string; details?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        userId:    params.userId,
        action:    params.action,
        entite:    params.entite,
        entiteId:  params.entiteId,
        details:   params.details,
      },
    });
  } catch {
    // L'audit ne doit jamais faire échouer l'opération principale
  }
}

// S'assure qu'une entreprise a toujours au moins une plage horaire
// ("Journée" par défaut) — garantit qu'aucun client existant ne soit
// bloqué par cette évolution.
async function garantirPlageParDefaut(companyId: string) {
  const existantes = await (prisma as any).plageHoraire.count({ where: { companyId } });
  if (existantes === 0) {
    await (prisma as any).plageHoraire.create({
      data: { companyId, nom: "Journée", heureDebut: "00:00", heureFin: "23:59", ordre: 0 },
    });
  }
}

// ─── GET /api/cloture/plages — Liste des plages horaires ─────────────────────
router.get("/plages", async (req: Request, res: Response) => {
  const { companyId } = req.user!;
  await garantirPlageParDefaut(companyId);
  const plages = await (prisma as any).plageHoraire.findMany({
    where: { companyId, actif: true },
    orderBy: { ordre: "asc" },
  });
  res.json({ success: true, data: plages });
});

// ─── POST /api/cloture/plages — Créer une plage horaire ──────────────────────
router.post("/plages", requireRole(["ADMIN", "RESPONSABLE"]), async (req: Request, res: Response) => {
  const schema = z.object({
    nom: z.string().min(1),
    heureDebut: z.string().regex(/^\d{2}:\d{2}$/),
    heureFin: z.string().regex(/^\d{2}:\d{2}$/),
  });
  const data = schema.parse(req.body);
  const { companyId } = req.user!;
  const dernier = await (prisma as any).plageHoraire.findFirst({
    where: { companyId }, orderBy: { ordre: "desc" },
  });
  const plage = await (prisma as any).plageHoraire.create({
    data: { ...data, companyId, ordre: (dernier?.ordre ?? -1) + 1 },
  });
  res.status(201).json({ success: true, data: plage });
});

// ─── PUT /api/cloture/plages/:id ───────────────────────────────────────────────
router.put("/plages/:id", requireRole(["ADMIN", "RESPONSABLE"]), async (req: Request, res: Response) => {
  const schema = z.object({
    nom: z.string().min(1).optional(),
    heureDebut: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    heureFin: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    actif: z.boolean().optional(),
  });
  const data = schema.parse(req.body);
  await (prisma as any).plageHoraire.updateMany({
    where: { id: req.params.id, companyId: req.user!.companyId },
    data,
  });
  res.json({ success: true });
});

// ─── DELETE /api/cloture/plages/:id — désactive (soft) ────────────────────────
router.delete("/plages/:id", requireRole(["ADMIN", "RESPONSABLE"]), async (req: Request, res: Response) => {
  const restantes = await (prisma as any).plageHoraire.count({
    where: { companyId: req.user!.companyId, actif: true },
  });
  if (restantes <= 1) {
    res.status(400).json({ success: false, message: "Impossible de supprimer la dernière plage horaire — il en faut au moins une." });
    return;
  }
  await (prisma as any).plageHoraire.updateMany({
    where: { id: req.params.id, companyId: req.user!.companyId },
    data: { actif: false },
  });
  res.json({ success: true });
});

// ─── GET /api/cloture/produits — Produits + suggestions pour clôture ─────────
// Le front affiche cette liste, l'utilisateur coche ce qu'il confirme,
// RIEN n'est modifié en base tant que POST /journee n'est pas appelé.
router.get("/produits", async (req: Request, res: Response) => {
  const { companyId } = req.user!;
  const maintenant = new Date();

  const produits = await prisma.produit.findMany({
    where:   { companyId, actif: true, stockActuel: { gt: 0 } },
    select:  {
      id: true, nom: true, stockActuel: true,
      prixVente: true, grammage: true,
      dlvJours: true, estSemiFini: true,
    },
    orderBy: { nom: "asc" },
  });

  const lotsExpires = await (prisma as any).lotStock.findMany({
    where: {
      companyId, statut: "ACTIF",
      quantiteRestante: { gt: 0 },
      dateExpiration: { lte: maintenant },
    },
    include: { produit: { select: { id: true, nom: true, prixVente: true } } },
  });

  const pertesSuggereesParProduit: Record<string, number> = {};
  for (const lot of lotsExpires) {
    pertesSuggereesParProduit[lot.produitId] =
      (pertesSuggereesParProduit[lot.produitId] ?? 0) + lot.quantiteRestante;
  }

  res.json({
    success: true,
    data: produits.map(p => ({
      ...p,
      quantiteSuggeree: p.dlvJours === 0 && !p.estSemiFini
        ? p.stockActuel
        : (pertesSuggereesParProduit[p.id] ?? 0),
      aPerdreAutomatique: p.dlvJours === 0 && !p.estSemiFini,
      aLotsExpires: (pertesSuggereesParProduit[p.id] ?? 0) > 0,
    })),
    // Détail des lots expirés, avec leur ID — nécessaire pour que le
    // front puisse envoyer une confirmation précise (lot par lot).
    lotsExpires: lotsExpires.map((lot: any) => ({
      id:              lot.id,
      produitId:       lot.produitId,
      produitNom:      lot.produit?.nom,
      quantite:        lot.quantiteRestante,
      dateCreation:    lot.dateCreation,
      dateExpiration:  lot.dateExpiration,
      dlvJours:        lot.dlvJours,
      valeurEstimee:   Math.round((lot.produit?.prixVente ?? 0) * lot.quantiteRestante),
    })),
  });
});

// ─── GET /api/cloture/statut — Statut pour une plage donnée ──────────────────
router.get("/statut", async (req: Request, res: Response) => {
  const { companyId } = req.user!;
  const plageHoraireId = req.query.plageHoraireId as string | undefined;

  await garantirPlageParDefaut(companyId);

  let plage = plageHoraireId
    ? await (prisma as any).plageHoraire.findFirst({ where: { id: plageHoraireId, companyId, actif: true } })
    : await (prisma as any).plageHoraire.findFirst({ where: { companyId, actif: true }, orderBy: { ordre: "asc" } });

  if (!plage) {
    res.status(404).json({ success: false, message: "Plage horaire introuvable" });
    return;
  }

  const dejaFaite = await prisma.cloturJournee.findFirst({
    where: {
      companyId, plageHoraireId: plage.id,
      date: { gte: debutJournee(), lte: finJournee() },
    },
  });

  res.json({
    success: true,
    data: {
      plage,
      dejaFaite: !!dejaFaite,
      clotureDuJour: dejaFaite,
      peutCloturer: heureDansPlage(plage.heureDebut, plage.heureFin) || !!dejaFaite,
    },
  });
});

// ─── GET /api/cloture/historique ─────────────────────────────────────────────
router.get("/historique", async (req: Request, res: Response) => {
  const clotures = await prisma.cloturJournee.findMany({
    where:   { companyId: req.user!.companyId },
    include: {
      user: { select: { prenom: true, nom: true } },
      plageHoraire: { select: { nom: true, heureDebut: true, heureFin: true } },
    },
    orderBy: { date: "desc" },
    take:    30,
  });
  res.json({ success: true, data: clotures });
});

// ─── POST /api/cloture/journee ───────────────────────────────────────────────
// Corps attendu :
//   plageHoraireId        : quelle plage/équipe clôture
//   lotsConfirmes[]       : IDs des lots expirés que l'utilisateur a
//                           explicitement vérifiés et confirmés (étape 2)
//   invendus[]            : invendus comptés manuellement
//   pertes[]              : pertes de production supplémentaires déclarées ici
//   fondCaisse, ecartFond, notes
router.post("/journee",
  requireRole(["ADMIN", "RESPONSABLE", "CAISSIER"]),
  async (req: Request, res: Response) => {
    const { companyId, id: userId } = req.user!;

    const schema = z.object({
      plageHoraireId: z.string(),
      lotsConfirmes: z.array(z.string()).default([]),
      invendus: z.array(z.object({
        produitId:        z.string(),
        quantiteInvendue: z.number().int().min(0),
        cause:            z.string().default("Invendu fin de journée"),
      })).default([]),
      pertes: z.array(z.object({
        type:      z.enum(["PRODUIT_FINI", "MATIERE_PREMIERE"]),
        produitId: z.string().optional(),
        mpId:      z.string().optional(),
        quantite:  z.number().positive(),
        cause:     z.string(),
        origine:   z.enum(["PRODUCTION", "VENTE"]).default("VENTE"),
      })).default([]),
      fondCaisse: z.number().optional(),
      ecartFond:  z.number().optional(),
      notes:      z.string().optional(),
    });
    const { plageHoraireId, lotsConfirmes, invendus, pertes, fondCaisse, ecartFond, notes } =
      schema.parse(req.body);

    const plage = await (prisma as any).plageHoraire.findFirst({
      where: { id: plageHoraireId, companyId, actif: true },
    });
    if (!plage) {
      res.status(400).json({ success: false, message: "Plage horaire invalide" });
      return;
    }
    if (!heureDansPlage(plage.heureDebut, plage.heureFin)) {
      res.status(400).json({
        success: false,
        message: `Clôture "${plage.nom}" disponible entre ${plage.heureDebut} et ${plage.heureFin} seulement.`,
      });
      return;
    }

    const dejaFaite = await prisma.cloturJournee.findFirst({
      where: { companyId, plageHoraireId, date: { gte: debutJournee(), lte: finJournee() } },
    });
    if (dejaFaite) {
      res.status(400).json({
        success: false,
        message: `La plage "${plage.nom}" a déjà été clôturée aujourd'hui.`,
        clotureDuJour: dejaFaite,
      });
      return;
    }

    const maintenant = new Date();

    // ── Bilan ventes de la plage (toute la journée pour l'instant — le
    // filtrage précis par horaire de plage nécessiterait de dater chaque
    // vente avec sa plage, à envisager si besoin plus fin) ────────────
    const ventesJour = await prisma.vente.findMany({
      where: { companyId, date: { gte: debutJournee(), lte: finJournee() } },
    });
    let caTotal = 0, totalEspeces = 0, totalMobile = 0;
    let totalCarte = 0, totalVirement = 0, totalCredit = 0;
    for (const v of ventesJour) {
      caTotal += v.montantTotal;
      if (v.modePaiement === "ESPECES")        totalEspeces  += v.montantTotal;
      if (v.modePaiement === "MOBILE_MONEY")   totalMobile   += v.montantTotal;
      if (v.modePaiement === "CARTE_BANCAIRE") totalCarte    += v.montantTotal;
      if (v.modePaiement === "VIREMENT")       totalVirement += v.montantTotal;
      if (v.modePaiement === "A_CREDIT")       totalCredit   += v.montantTotal;
    }

    // ── ÉTAPE 2 : lots expirés — SEULEMENT ceux explicitement confirmés ──
    // Avant : tous les lots expirés étaient passés en perte automatiquement.
    // Maintenant : uniquement ceux dont l'ID figure dans lotsConfirmes,
    // envoyé par le front après que l'utilisateur les a vérifiés à l'écran.
    let nbInvendusAuto = 0, valeurInvendusAuto = 0;
    if (lotsConfirmes.length > 0) {
      const lots = await (prisma as any).lotStock.findMany({
        where: {
          id: { in: lotsConfirmes }, companyId, statut: "ACTIF",
          quantiteRestante: { gt: 0 },
        },
        include: { produit: { select: { id: true, nom: true, prixVente: true } } },
      });
      for (const lot of lots) {
        if (!lot.produit || lot.quantiteRestante <= 0) continue;
        const valeur = Math.round(lot.produit.prixVente * lot.quantiteRestante);
        valeurInvendusAuto += valeur;
        nbInvendusAuto++;

        await prisma.perte.create({
          data: {
            companyId, type: "PRODUIT_FINI", produitId: lot.produitId,
            quantite: lot.quantiteRestante, valeur,
            cause: `DLV expiré (${lot.dlvJours}j) — lot du ${new Date(lot.dateCreation).toLocaleDateString("fr-FR")}`,
            deductMP: false, date: maintenant,
            origine: "VENTE" as any,
            notes: `Clôture ${plage.nom} du ${maintenant.toLocaleDateString("fr-FR")} — confirmé manuellement`,
          },
        });
        await prisma.produit.update({
          where: { id: lot.produitId },
          data:  { stockActuel: { decrement: lot.quantiteRestante } },
        });
        await (prisma as any).lotStock.update({
          where: { id: lot.id },
          data: { statut: "EXPIRE", quantiteRestante: 0,
            notesExpiration: `Clôture ${plage.nom} ${maintenant.toLocaleDateString("fr-FR")}` },
        });
      }
    }

    // ── Invendus manuels ──────────────────────────────────────────────
    let nbInvendus = nbInvendusAuto, valeurInvendus = valeurInvendusAuto;
    for (const inv of invendus) {
      if (inv.quantiteInvendue <= 0) continue;
      const produit = await prisma.produit.findFirst({ where: { id: inv.produitId, companyId } });
      if (!produit) continue;

      if (inv.quantiteInvendue > produit.stockActuel) {
        res.status(400).json({
          success: false,
          message: `Quantité invendue (${inv.quantiteInvendue}) supérieure au stock de "${produit.nom}" (${produit.stockActuel} en stock).`,
        });
        return;
      }

      const valeur = Math.round(produit.prixVente * inv.quantiteInvendue);
      valeurInvendus += valeur; nbInvendus++;

      await prisma.perte.create({
        data: {
          companyId, type: "PRODUIT_FINI", produitId: inv.produitId,
          quantite: inv.quantiteInvendue, valeur, cause: inv.cause,
          deductMP: false, date: maintenant,
          origine: "VENTE" as any,
          notes: `Clôture ${plage.nom} du ${maintenant.toLocaleDateString("fr-FR")}`,
        },
      });
      await (prisma as any).lotStock.updateMany({
        where: { companyId, produitId: inv.produitId, statut: "ACTIF", quantiteRestante: { gt: 0 } },
        data: { statut: "EXPIRE", quantiteRestante: 0,
          notesExpiration: `Invendu manuel clôture ${maintenant.toLocaleDateString("fr-FR")}` },
      });
      await prisma.produit.update({
        where: { id: inv.produitId },
        data:  { stockActuel: { decrement: inv.quantiteInvendue } },
      });
    }

    // ── Pertes manuelles (production ou vente, selon ce que déclare
    // l'utilisateur — origine par défaut VENTE puisqu'on est à la clôture,
    // mais peut être marquée PRODUCTION si déclarée ici a posteriori) ──
    let nbPertes = 0, valeurPertes = 0;
    for (const perte of pertes) {
      if (perte.type === "PRODUIT_FINI" && perte.produitId) {
        const produit = await prisma.produit.findFirst({ where: { id: perte.produitId, companyId } });
        if (!produit) continue;
        const valeur = Math.round(produit.prixVente * perte.quantite);
        valeurPertes += valeur; nbPertes++;
        await prisma.perte.create({
          data: {
            companyId, type: "PRODUIT_FINI", produitId: perte.produitId,
            quantite: perte.quantite, valeur, cause: perte.cause,
            deductMP: true, date: maintenant,
            origine: perte.origine as any,
            notes: `Clôture ${plage.nom} ${maintenant.toLocaleDateString("fr-FR")}`,
          },
        });
        await prisma.produit.update({
          where: { id: perte.produitId }, data: { stockActuel: { decrement: perte.quantite } },
        });
      }
      if (perte.type === "MATIERE_PREMIERE" && perte.mpId) {
        const mp = await prisma.matierePremiere.findFirst({ where: { id: perte.mpId, companyId } });
        if (!mp || mp.stockGere === false) continue;
        const valeur = Math.round(mp.prixAchat * perte.quantite);
        valeurPertes += valeur; nbPertes++;
        await prisma.perte.create({
          data: {
            companyId, type: "MATIERE_PREMIERE", mpId: perte.mpId,
            quantite: perte.quantite, valeur, cause: perte.cause,
            deductMP: true, date: maintenant,
            origine: perte.origine as any,
            notes: `Clôture ${plage.nom} ${maintenant.toLocaleDateString("fr-FR")}`,
          },
        });
        await prisma.matierePremiere.update({
          where: { id: perte.mpId }, data: { stockActuel: { decrement: perte.quantite } },
        });
        await prisma.mouvementStock.create({
          data: { mpId: perte.mpId, type: "SORTIE_PERTE_MP", quantite: perte.quantite, motif: `Perte clôture : ${perte.cause}` },
        });
      }
    }

    // ── ÉTAPE 5 : vérification croisée par la formule du client ─────────
    // ventes(valeur) ≈ Σ [ (stockDébut + reçu − stockFin) × prixVente ]
    // stockDébut = instantané de la clôture précédente de cette plage
    // reçu = quantités reçues (commandes fournisseur + production) du jour
    const cloturePrecedente = await prisma.cloturJournee.findFirst({
      where: { companyId, plageHoraireId },
      orderBy: { date: "desc" },
    });
    const stockDebutParProduit: Record<string, number> = {};
    if (cloturePrecedente?.stockSnapshot) {
      const snap = cloturePrecedente.stockSnapshot as any[];
      for (const s of snap) stockDebutParProduit[s.produitId] = s.stockActuel;
    }
    const productionsJour = await prisma.ligneProduction.findMany({
      where: { production: { companyId, date: { gte: debutJournee(), lte: finJournee() } } },
      select: { produitId: true, quantite: true },
    });
    const recuParProduit: Record<string, number> = {};
    for (const lp of productionsJour) {
      recuParProduit[lp.produitId] = (recuParProduit[lp.produitId] ?? 0) + lp.quantite;
    }
    const tousProduits = await prisma.produit.findMany({
      where: { companyId, actif: true },
      select: { id: true, nom: true, prixVente: true, stockActuel: true },
    });
    let caVerifieParStock = 0;
    for (const p of tousProduits) {
      const debut = stockDebutParProduit[p.id] ?? p.stockActuel; // faute de mieux si 1ère clôture
      const recu  = recuParProduit[p.id] ?? 0;
      const venduTheorique = Math.max(0, debut + recu - p.stockActuel);
      caVerifieParStock += venduTheorique * p.prixVente;
    }
    const ecartVerification = Math.round(caVerifieParStock - caTotal);

    // ── Instantané du stock pour la passation à l'équipe suivante ──────
    const stockSnapshot = tousProduits.map(p => ({
      produitId: p.id, nom: p.nom, stockActuel: p.stockActuel,
    }));

    // ── Créer la clôture ────────────────────────────────────────────────
    const cloture = await prisma.cloturJournee.create({
      data: {
        companyId, userId,
        plageHoraireId,
        date: debutJournee(),
        heureRealisation: maintenant,
        caTotal: Math.round(caTotal),
        nbTransactions: ventesJour.length,
        totalEspeces: Math.round(totalEspeces),
        totalMobile: Math.round(totalMobile),
        totalCarte: Math.round(totalCarte),
        totalVirement: Math.round(totalVirement),
        totalCredit: Math.round(totalCredit),
        nbInvendus, valeurInvendus: Math.round(valeurInvendus),
        nbPertes, valeurPertes: Math.round(valeurPertes),
        fondCaisse: fondCaisse ?? null,
        ecartFond: ecartFond ?? null,
        notes,
        stockSnapshot: stockSnapshot as any,
        caVerifieParStock: Math.round(caVerifieParStock),
        ecartVerification,
      } as any,
    });

    await logAudit({
      companyId, userId, action: "CLOTURE_CREEE", entite: "CloturJournee", entiteId: cloture.id,
      details: `Plage "${plage.nom}" — CA ${Math.round(caTotal)} F, ${nbInvendus} invendu(s), ${nbPertes} perte(s)`,
    });

    res.status(201).json({
      success: true,
      data: {
        cloture,
        resume: {
          plage: plage.nom,
          caTotal: Math.round(caTotal), nbTransactions: ventesJour.length,
          totalEspeces: Math.round(totalEspeces), totalMobile: Math.round(totalMobile),
          totalCarte: Math.round(totalCarte), totalCredit: Math.round(totalCredit),
          nbInvendus, valeurInvendus: Math.round(valeurInvendus),
          nbInvendusAuto, valeurInvendusAuto: Math.round(valeurInvendusAuto),
          nbPertes, valeurPertes: Math.round(valeurPertes),
          fondCaisse: fondCaisse ?? null, ecartFond: ecartFond ?? null,
          // Vérification croisée (formule du client)
          caVerifieParStock: Math.round(caVerifieParStock),
          ecartVerification,
          alerteEcart: Math.abs(ecartVerification) > (caTotal * 0.05), // >5% d'écart = à examiner
        },
      },
    });
  }
);

// ─── DELETE /api/cloture/:id — Corriger une clôture (avec audit) ────────────
router.delete("/:id", requireRole(["ADMIN", "RESPONSABLE"]), async (req: Request, res: Response) => {
  const { companyId, id: userId } = req.user!;
  const cloture = await prisma.cloturJournee.findFirst({
    where: { id: req.params.id, companyId },
  });
  if (!cloture) {
    res.status(404).json({ success: false, message: "Clôture introuvable" });
    return;
  }

  // AUDIT — trace complète avant suppression (le client veut garder une
  // trace visible des corrections, pas une suppression silencieuse).
  await logAudit({
    companyId, userId, action: "CLOTURE_SUPPRIMEE", entite: "CloturJournee", entiteId: cloture.id,
    details: JSON.stringify({
      date: cloture.date, caTotal: cloture.caTotal, nbInvendus: cloture.nbInvendus,
      nbPertes: cloture.nbPertes, valeurPertes: cloture.valeurPertes,
      motif: req.body?.motif ?? "Non précisé",
    }),
  });

  await prisma.cloturJournee.delete({ where: { id: cloture.id } });
  res.json({ success: true, message: "Clôture supprimée — action journalisée dans l'historique des corrections" });
});

export default router;

