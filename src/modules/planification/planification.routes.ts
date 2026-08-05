import { Router, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.middleware";
import prisma from "../../config/database";

const router = Router();
router.use(authMiddleware);

// GET /api/planification
router.get("/", async (req: Request, res: Response) => {
  const { companyId } = req.user!;

  
  const [commandesEnAttente, recettes] = await Promise.all([
    prisma.commandeClient.findMany({
      where: { companyId, statut: { in: ["RECUE", "EN_PRODUCTION"] } },
      include: {
        client: { select: { nom: true } },
        lignes: {
          include: {
            produit: {
              include: {
                recette: { select: { id: true, nom: true, ratioPate: true } },
              },
            },
          },
        },
      },
      orderBy: { dateLivraison: "asc" },
    }),

    prisma.recette.findMany({
      where: { companyId, actif: true },
      include: {
        produits: {
          where: { actif: true },
          select: { id: true, nom: true, grammage: true, stockActuel: true },
        },
        ingredients: {
          include: {
            mp: {
              select: {
                id: true, nom: true, stockActuel: true,
                unite: { select: { abreviation: true } },
              },
            },
            unite: { select: { abreviation: true, coefficient: true } },
          },
        },
      },
      orderBy: { nom: "asc" },
    }),
  ]);

  res.json({ success: true, data: { commandesEnAttente, recettes } });
});

// POST /api/planification/calculer
router.post("/calculer", async (req: Request, res: Response) => {
  const schema = z.object({
    lignes: z.array(
      z.object({
        recetteId: z.string(),
        objectifs: z.array(
          z.object({
            produitId: z.string(),
            quantite: z.number().int().min(0),
          })
        ),
      })
    ),
  });

  const { lignes } = schema.parse(req.body);
  const { companyId } = req.user!;
  const resultats = [];

  for (const ligne of lignes) {
    const recette = await prisma.recette.findFirst({
      where: { id: ligne.recetteId, companyId },
      include: {
        ingredients: {
          include: {
            mp: {
              select: {
                id: true, nom: true, stockActuel: true,
                unite: { select: { abreviation: true } },
              },
            },
            unite: { select: { abreviation: true, coefficient: true } },
          },
        },
        produits: {
          where: { id: { in: ligne.objectifs.map((o) => o.produitId) } },
          select: { id: true, nom: true, grammage: true },
        },
      },
    });

    if (!recette) continue;

    let pateNecessaireGrammes = 0;
    const detailProduits = [];

    for (const obj of ligne.objectifs) {
      if (obj.quantite <= 0) continue;
      const produit = recette.produits.find((p) => p.id === obj.produitId);
      if (!produit || !produit.grammage) continue;

      const pateNecessaire = obj.quantite * produit.grammage;
      pateNecessaireGrammes += pateNecessaire;

      detailProduits.push({
        produitId: produit.id,
        nom: produit.nom,
        grammage: produit.grammage,
        quantite: obj.quantite,
        pateNecessaire: Math.round(pateNecessaire),
      });
    }

    if (pateNecessaireGrammes === 0) continue;

    const pateNecessaireKg = pateNecessaireGrammes / 1000;
    const farineNecessaireKg =
      Math.ceil((pateNecessaireKg / recette.ratioPate) * 10) / 10;

    const mpNecessaires = recette.ingredients.map((ing) => {
      const coeff = ing.unite?.coefficient ?? 1;
      const quantiteNecessaire = ing.quantite * farineNecessaireKg;
      const quantiteEnUniteBase = quantiteNecessaire * coeff;
      const stockSuffisant = ing.mp.stockActuel >= quantiteEnUniteBase;
      const manque = stockSuffisant
        ? 0
        : quantiteEnUniteBase - ing.mp.stockActuel;

      return {
        mpId: ing.mp.id,
        nom: ing.mp.nom,
        quantiteNecessaire: Math.round(quantiteNecessaire * 100) / 100,
        unite: ing.unite?.abreviation ?? "u",
        stockActuel: ing.mp.stockActuel,
        stockSuffisant,
        manque: Math.round(manque * 100) / 100,
      };
    });

    resultats.push({
      recetteId: recette.id,
      recetteNom: recette.nom,
      ratioPate: recette.ratioPate,
      farineNecessaireKg,
      pateObtenue:
        Math.round(farineNecessaireKg * recette.ratioPate * 100) / 100,
      detailProduits,
      mpNecessaires,
      stockOk: mpNecessaires.every((m) => m.stockSuffisant),
    });
  }

  


  res.json({ success: true, data: resultats });
});

export default router;
