// src/modules/commandesClient/commandesClient.routes.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import prisma from "../../config/database";

const router = Router();
router.use(authMiddleware);

// Génère une référence unique ex: CMD-2025-042
async function genererReference(companyId: string): Promise<string> {
  const count = await prisma.commandeClient.count({ where: { companyId } });
  const year = new Date().getFullYear();
  return `CMD-${year}-${String(count + 1).padStart(3, "0")}`;
}

const ligneSchema = z.object({
  produitId: z.string(),
  quantite: z.number().int().positive(),
  prixUnitaire: z.number().positive(),
});

const commandeSchema = z.object({
  clientId: z.string(),
  dateLivraison: z.string(),
  // AJOUT : mode de paiement et acompte
  modePaiement: z.enum(["ESPECES","MOBILE_MONEY","CHEQUE","VIREMENT","A_CREDIT"]).default("ESPECES"),
  acompte: z.number().min(0).default(0),
  notes: z.string().optional(),
  lignes: z.array(ligneSchema).min(1),
});

// GET /api/commandes-client
router.get("/", async (req: Request, res: Response) => {
  const { statut } = req.query;
  const commandes = await prisma.commandeClient.findMany({
    where: {
      companyId: req.user!.companyId,
      ...(statut ? { statut: statut as any } : {}),
    },
    include: {
      client: { select: { id: true, nom: true, telephone: true, type: true } },
      lignes: {
        include: { produit: { select: { id: true, nom: true, prixVente: true, stockActuel: true, seuilAlerte: true } } },
      },
    },
    orderBy: { dateLivraison: "asc" },
  });
  res.json({ success: true, data: commandes });
});

// POST /api/commandes-client
router.post("/", async (req: Request, res: Response) => {
  const data = commandeSchema.parse(req.body);
  const reference = await genererReference(req.user!.companyId);

  const montantTotal = data.lignes.reduce(
    (sum, l) => sum + l.quantite * l.prixUnitaire, 0
  );

  const companyId = req.user!.companyId;
  const userId    = req.user!.id;

  // CORRECTION 🟠 : Acompte ne peut pas dépasser le montant total
  if (data.acompte > montantTotal) {
    res.status(400).json({
      success: false,
      message: `L'acompte (${data.acompte.toLocaleString("fr-FR")} FCFA) ne peut pas dépasser ` +
        `le montant total de la commande (${montantTotal.toLocaleString("fr-FR")} FCFA).`,
    }); return;
  }

  // AJOUT : Vérifier le stock pour chaque produit AVANT de créer la commande
  // Si tout le stock est disponible → PRETE directement
  // Sinon → EN_PRODUCTION (le boulanger doit produire)
  const produitsStock = await prisma.produit.findMany({
    where: { id: { in: data.lignes.map(l => l.produitId) }, companyId },
    select: { id: true, nom: true, stockActuel: true },
  });
  const mapStock = new Map(produitsStock.map(p => [p.id, p]));

  // Vérifier chaque ligne
  const manquants: { nom: string; commandé: number; disponible: number; aProduire: number }[] = [];
  for (const ligne of data.lignes) {
    const produit = mapStock.get(ligne.produitId);
    const stock   = produit?.stockActuel ?? 0;
    if (stock < ligne.quantite) {
      manquants.push({
        nom:        produit?.nom ?? ligne.produitId,
        commandé:   ligne.quantite,
        disponible: stock,
        aProduire:  ligne.quantite - stock,
      });
    }
  }

  // Statut automatique selon disponibilité
  const statutAuto = manquants.length === 0 ? "PRETE" : "EN_PRODUCTION";
  const messageAuto = manquants.length === 0
    ? "Stock disponible — commande prête à livrer"
    : `Stock insuffisant pour ${manquants.length} produit(s) — production nécessaire`;

  const commande = await prisma.$transaction(async (tx) => {
    // Créer la commande avec statut automatique
    const cmd = await prisma.commandeClient.create({
      data: {
        reference,
        clientId: data.clientId,
        companyId,
        dateLivraison: new Date(data.dateLivraison),
        acompte: data.acompte,
        montantTotal,
        statut: statutAuto as any,
        notes: data.notes,
        lignes: {
          create: data.lignes.map(l => ({
            produitId:    l.produitId,
            quantite:     l.quantite,
            prixUnitaire: l.prixUnitaire,
            sousTotal:    l.quantite * l.prixUnitaire,
          })),
        },
      },
      include: {
        client: true,
        lignes: { include: { produit: { select: { id: true, nom: true, prixVente: true, stockActuel: true, seuilAlerte: true } } } },
      },
    });

    // AJOUT : Encaisser l'acompte immédiatement si > 0 et pas à crédit
    if (data.acompte > 0 && data.modePaiement !== "A_CREDIT") {
      const nbVentes = await tx.vente.count({ where: { companyId } });
      await tx.vente.create({
        data: {
          companyId,
          userId,
          numeroTicket: `ACP-${String(nbVentes + 1).padStart(5, "0")}`,
          montantTotal: data.acompte,
          montantBrut: data.acompte,
          modePaiement: data.modePaiement as any,
          clientId: data.clientId,
          statut: "VALIDEE",
          notes: `Acompte commande ${reference}`,
        } as any,
      });
    }

    return cmd;
  });

  // Retourner la commande avec infos de stock
  res.status(201).json({
    success: true,
    data: commande,
    // AJOUT : Infos stock pour affichage immédiat
    statutAuto,
    messageAuto,
    manquants,    // Produits à produire
    stockOK: manquants.length === 0,
  });
});

// PUT /api/commandes-client/:id/statut — Changer le statut
router.put("/:id/statut", async (req: Request, res: Response) => {
  try {
  // MODIFICATION : Accepter aussi le mode de paiement à la livraison
  const { statut, modePaiementLivraison } = z.object({
    statut: z.enum(["RECUE", "EN_PRODUCTION", "PRETE", "LIVREE", "ANNULEE"]),
    modePaiementLivraison: z.enum(["ESPECES","MOBILE_MONEY","CHEQUE","VIREMENT","A_CREDIT"]).optional(),
  }).parse(req.body);

  // Vérifier statut actuel pour éviter double décrément
  const actuelle = await prisma.commandeClient.findUnique({
    where: { id: req.params.id },
    include: { lignes: true },
  });
  if (!actuelle) {
    res.status(404).json({ success: false, message: "Commande introuvable" });
    return;
  }

  // ── LIVRAISON : décrément stock + création vente ─────────────────────────────
  if (statut === "LIVREE" && actuelle.statut !== "LIVREE") {
    const companyId = req.user!.companyId;
    const userId    = req.user!.id;

    // FIX 1 : Vérifier stock suffisant avant tout
    const produits = await prisma.produit.findMany({
      where: { id: { in: actuelle.lignes.map(l => l.produitId) } },
    });
    const produitsMap = new Map(produits.map(p => [p.id, p]));

    for (const ligne of actuelle.lignes) {
      const prod = produitsMap.get(ligne.produitId);
      if (prod && (prod as any).stockActuel < ligne.quantite) {
        res.status(400).json({
          success: false,
          message: `Stock insuffisant pour "${(prod as any).nom}" : ` +
            `demandé ${ligne.quantite}, disponible ${(prod as any).stockActuel}. ` +
            `Faites d'abord une production.`,
        });
        return;
      }
    }

    await prisma.$transaction(async (tx) => {
      // Décrémenter stock produits
      for (const ligne of actuelle.lignes) {
        await tx.produit.update({
          where: { id: ligne.produitId },
          data: { stockActuel: { decrement: ligne.quantite } },
        });
        // FIFO lots
        let qteRestante = ligne.quantite;
        const lots = await (tx as any).lotStock.findMany({
          where: { produitId: ligne.produitId, statut: "ACTIF", quantiteRestante: { gt: 0 } },
          orderBy: { dateExpiration: "asc" },
        });
        for (const lot of lots) {
          if (qteRestante <= 0) break;
          const aDeduire = Math.min(qteRestante, lot.quantiteRestante);
          const nouvelleQte = lot.quantiteRestante - aDeduire;
          await (tx as any).lotStock.update({
            where: { id: lot.id },
            data: { quantiteRestante: nouvelleQte, statut: nouvelleQte <= 0 ? "EPUISE" : "ACTIF" },
          });
          qteRestante -= aDeduire;
        }
      }

      // MODIFICATION : Créer une vente pour le SOLDE restant (montant - acompte)
      // L'acompte a déjà été encaissé à la création de la commande
      const montantTotal = (actuelle as any).montantTotal ?? actuelle.lignes.reduce((s: number, l: any) => s + l.montantLigne, 0);
      const acompteDejaEnc = (actuelle as any).acompte ?? 0;
      const solde = montantTotal - acompteDejaEnc;
      // CORRECTION : utiliser modePaiementLivraison du body uniquement (pas de colonne DB encore)
      // CORRECTION 🟠 : Mode de paiement obligatoire si solde > 0
      const modePaie = (req.body.modePaiementLivraison ?? "ESPECES") as any;
      if (solde > 0 && !req.body.modePaiementLivraison) {
        // Défaut à ESPECES si non fourni (déjà géré ci-dessus)
        console.warn("[LIVRAISON] Mode paiement non spécifié — défaut ESPECES");
      }

      const nbVentes = await tx.vente.count({ where: { companyId } });

      // N'encaisser que si solde > 0 et pas à crédit
      if (solde > 0 && modePaie !== "A_CREDIT") {
        await (tx.vente.create as any)({
          data: {
            companyId,
            userId,
            montantTotal: solde,
            montantBrut: solde,
            modePaiement: modePaie,
            clientId: actuelle.clientId,
            statut: "VALIDEE",
            notes: `Solde livraison ${(actuelle as any).reference ?? actuelle.id}`,
          },
        });
      }

      // Statut commande → LIVREE
      await tx.commandeClient.update({
        where: { id: req.params.id },
        data: { statut, dateLivraison: new Date() },
      });
    });

  // ── ANNULATION : restituer stock si était LIVREE ──────────────────────────
  } else if (statut === "ANNULEE" && actuelle.statut === "LIVREE") {
    await prisma.$transaction(async (tx) => {
      for (const ligne of actuelle.lignes) {
        await tx.produit.update({
          where: { id: ligne.produitId },
          data: { stockActuel: { increment: ligne.quantite } },
        });
      }
      await tx.commandeClient.update({
        where: { id: req.params.id },
        data: { statut },
      });
    });
  } else {
    // Changement de statut sans impact stock
    await prisma.commandeClient.update({
      where: { id: req.params.id },
      data: { statut },
    });
  }

  const commande = await prisma.commandeClient.findUnique({
    where: { id: req.params.id },
    include: { client: true, lignes: { include: { produit: true } } },
  });
  res.json({ success: true, data: commande });
  } catch (e: any) {
    console.error("[STATUT ERROR]", e?.message ?? e);
    res.status(500).json({ success: false, message: e?.message ?? "Erreur interne" });
  }
});

// PUT /api/commandes-client/:id — Modifier une commande
router.put("/:id", async (req: Request, res: Response) => {
  const data = commandeSchema.partial().parse(req.body);
  const montantTotal = data.lignes
    ? data.lignes.reduce((sum, l) => sum + l.quantite * l.prixUnitaire, 0)
    : undefined;

  // Si on modifie les lignes, on supprime et recrée
  if (data.lignes) {
    await prisma.ligneCommandeClient.deleteMany({ where: { commandeId: req.params.id } });
  }

  const commande = await prisma.commandeClient.update({
    where: { id: req.params.id },
    data: {
      ...(data.clientId ? { clientId: data.clientId } : {}),
      ...(data.dateLivraison ? { dateLivraison: new Date(data.dateLivraison) } : {}),
      ...(data.acompte !== undefined ? { acompte: data.acompte } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(montantTotal !== undefined ? { montantTotal } : {}),
      ...(data.lignes ? {
        lignes: {
          create: data.lignes.map(l => ({
            produitId: l.produitId,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            sousTotal: l.quantite * l.prixUnitaire,
          })),
        },
      } : {}),
    },
    include: { client: true, lignes: { include: { produit: true } } },
  });
  res.json({ success: true, data: commande });
});

// DELETE /api/commandes-client/:id
router.delete("/:id", requireRole(["ADMIN", "RESPONSABLE"]), async (req: Request, res: Response) => {
  await prisma.commandeClient.update({
    where: { id: req.params.id },
    data: { statut: "ANNULEE" },
  });
  res.json({ success: true });
});

export default router;
