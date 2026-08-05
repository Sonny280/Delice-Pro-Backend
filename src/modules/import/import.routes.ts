// src/modules/import/import.routes.ts
// Import en masse : catégories, unités, MP, produits, recettes
// depuis un fichier Excel structuré

import { Router, Request, Response } from "express";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import prisma from "../../config/database";
import multer from "multer";
import * as XLSX from "xlsx";

const router = Router();
router.use(authMiddleware);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Helpers ─────────────────────────────────────────────────
function str(v: any) { return v != null ? String(v).trim() : ""; }
function num(v: any) { const n = parseFloat(str(v).replace(",", ".")); return isNaN(n) ? 0 : n; }
function bool(v: any) { return str(v).toLowerCase() === "oui" || str(v) === "1" || str(v).toLowerCase() === "true"; }
function sheetToRows(wb: XLSX.WorkBook, name: string): any[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

// ─── POST /api/import — Import complet ───────────────────────
router.post("/",
  requireRole(["ADMIN", "RESPONSABLE"]),
  (req: Request, res: Response) => {
    upload.single("fichier")(req, res, async (err) => {
      if (err) return res.status(400).json({ success: false, message: "Erreur upload: " + err.message });
      if (!req.file) return res.status(400).json({ success: false, message: "Aucun fichier reçu" });

      const companyId = req.user!.companyId;
      const rapport: any = {
        categories: { crees: 0, existants: 0, erreurs: [] },
        unites:     { crees: 0, existants: 0, erreurs: [] },
        mp:         { crees: 0, existants: 0, erreurs: [] },
        produits:   { crees: 0, existants: 0, erreurs: [] },
        recettes:   { crees: 0, existants: 0, erreurs: [] },
      };

      try {
        const wb = XLSX.read(req.file.buffer, { type: "buffer" });

        // ══ 1. CATÉGORIES ══
        const rowsCat = sheetToRows(wb, "Categories");
        for (const row of rowsCat) {
          const nom  = str(row["Nom"]);
          const type = str(row["Type"]).toUpperCase(); // PRODUIT | MATIERE_PREMIERE
          const margeMin = num(row["Marge Min %"]);
          if (!nom || !["PRODUIT", "MATIERE_PREMIERE"].includes(type)) {
            if (nom) rapport.categories.erreurs.push(`"${nom}" : type invalide (utiliser PRODUIT ou MATIERE_PREMIERE)`);
            continue;
          }
          try {
            const existing = await prisma.categorie.findFirst({ where: { nom, companyId } });
            if (existing) { rapport.categories.existants++; continue; }
            await prisma.categorie.create({ data: { nom, type: type as any, margeMin: margeMin || null, companyId } });
            rapport.categories.crees++;
          } catch (e: any) { rapport.categories.erreurs.push(`"${nom}" : ${e.message}`); }
        }

        // ══ 2. UNITÉS ══
        const rowsUnites = sheetToRows(wb, "Unites");
        for (const row of rowsUnites) {
          const nom         = str(row["Nom"]);
          const abreviation = str(row["Abreviation"]);
          const type        = str(row["Type"]).toUpperCase();
          const uniteBase   = str(row["Unite Base"]) || abreviation;
          const coefficient = num(row["Coefficient"]) || 1;
          if (!nom || !abreviation || !["MASSE","VOLUME","COMPTAGE","CONDITIONNEMENT"].includes(type)) {
            if (nom) rapport.unites.erreurs.push(`"${nom}" : données incomplètes`);
            continue;
          }
          try {
            const existing = await prisma.unite.findFirst({ where: { nom, companyId } });
            if (existing) { rapport.unites.existants++; continue; }
            await prisma.unite.create({ data: { nom, abreviation, type: type as any, uniteBase, coefficient, companyId } });
            rapport.unites.crees++;
          } catch (e: any) { rapport.unites.erreurs.push(`"${nom}" : ${e.message}`); }
        }

        // ══ 3. MATIÈRES PREMIÈRES ══
        const rowsMP = sheetToRows(wb, "Matieres Premieres");
        for (const row of rowsMP) {
          const nom           = str(row["Nom"]);
          const prixAchat     = num(row["Prix Achat"]);
          const stockActuel   = num(row["Stock Actuel"]);
          const seuilAlerte   = num(row["Seuil Alerte"]);
          const stockGere     = str(row["Stock Gere"]).toLowerCase() !== "non";
          const categorieNom  = str(row["Categorie"]);
          const uniteNom      = str(row["Unite"]);

          if (!nom) continue;
          try {
            const existing = await prisma.matierePremiere.findFirst({ where: { nom, companyId, actif: true } });
            if (existing) { rapport.mp.existants++; continue; }

            let categorieId: string | undefined;
            let uniteId: string | undefined;

            if (categorieNom) {
              const cat = await prisma.categorie.findFirst({ where: { nom: categorieNom, companyId } });
              if (cat) categorieId = cat.id;
            }
            if (uniteNom) {
              const unite = await prisma.unite.findFirst({ where: { nom: { contains: uniteNom }, companyId } });
              if (unite) uniteId = unite.id;
            }

            await prisma.matierePremiere.create({
              data: { nom, prixAchat, stockActuel, seuilAlerte, stockGere, categorieId, uniteId, companyId }
            });
            rapport.mp.crees++;
          } catch (e: any) { rapport.mp.erreurs.push(`"${nom}" : ${e.message}`); }
        }

        // ══ 4. PRODUITS ══
        const rowsProduits = sheetToRows(wb, "Produits");
        for (const row of rowsProduits) {
          const nom         = str(row["Nom"]);
          const prixVente   = num(row["Prix Vente"]);
          const prixAchat   = num(row["Prix Achat"]);
          const margeMin    = num(row["Marge Min %"]) || 25;
          const grammage    = num(row["Grammage g"]) || null;
          const seuilAlerte = num(row["Seuil Alerte"]) || 10;
          const dlvJours    = num(row["DLV Jours"]) || 1;
          const estSemiFini = bool(row["Semi Fini"]);
          const categorieNom = str(row["Categorie"]);

          if (!nom || !prixVente) {
            if (nom) rapport.produits.erreurs.push(`"${nom}" : prix vente manquant`);
            continue;
          }
          try {
            const existing = await prisma.produit.findFirst({ where: { nom, companyId, actif: true } });
            if (existing) { rapport.produits.existants++; continue; }

            let categorieId: string | undefined;
            if (categorieNom) {
              const cat = await prisma.categorie.findFirst({ where: { nom: categorieNom, companyId } });
              if (cat) categorieId = cat.id;
            }

            await (prisma.produit.create as any)({
              data: { nom, prixVente, prixAchat, margeMin, grammage, seuilAlerte, dlvJours, estSemiFini, categorieId, companyId }
            });
            rapport.produits.crees++;
          } catch (e: any) { rapport.produits.erreurs.push(`"${nom}" : ${e.message}`); }
        }

        // ══ 5. RECETTES ══
        const rowsRecettes = sheetToRows(wb, "Recettes");
        for (const row of rowsRecettes) {
          const nom                   = str(row["Nom"]);
          const ratioPate             = num(row["Ratio Pate"]) || 1;
          const tauxPerte             = num(row["Taux Perte %"]) || 0;
          const estViennoiserie       = bool(row["Est Viennoiserie"]);
          const ingredientReference   = str(row["Ingredient Reference"]) || "FARINE";
          const ingredientReferenceNom = str(row["Ingredient Reference Nom"]) || "Farine";
          const ingredientReferenceUnite = str(row["Ingredient Reference Unite"]) || "kg";
          const description           = str(row["Description"]);

          if (!nom) continue;
          try {
            const existing = await prisma.recette.findFirst({ where: { nom, companyId } });
            if (existing) { rapport.recettes.existants++; continue; }

            await (prisma.recette.create as any)({
              data: {
                nom, ratioPate, tauxPerte, estViennoiserie,
                ingredientReference, ingredientReferenceNom, ingredientReferenceUnite,
                description: description || null,
                companyId,
              }
            });
            rapport.recettes.crees++;
          } catch (e: any) { rapport.recettes.erreurs.push(`"${nom}" : ${e.message}`); }
        }

        // ══ 6. INGRÉDIENTS DES RECETTES ══
        const rowsIngredients = sheetToRows(wb, "Ingredients Recettes");
        let ingredientsCrees = 0;
        for (const row of rowsIngredients) {
          const recetteNom = str(row["Recette"]);
          const mpNom      = str(row["Matiere Premiere"]);
          const quantite   = num(row["Quantite par kg ref"]);
          const uniteNom   = str(row["Unite"]);

          if (!recetteNom || !mpNom || !quantite) continue;
          try {
            const recette = await prisma.recette.findFirst({ where: { nom: recetteNom, companyId } });
            const mp      = await prisma.matierePremiere.findFirst({ where: { nom: mpNom, companyId, actif: true } });
            if (!recette || !mp) continue;

            // Vérifier si l'ingrédient existe déjà
            const existing = await prisma.recetteIngredient.findFirst({
              where: { recetteId: recette.id, mpId: mp.id }
            });
            if (existing) continue;

            let uniteId: string | undefined;
            if (uniteNom) {
              const unite = await prisma.unite.findFirst({ where: { nom: { contains: uniteNom }, companyId } });
              if (unite) uniteId = unite.id;
            }

            await prisma.recetteIngredient.create({
              data: { recetteId: recette.id, mpId: mp.id, quantite, uniteId }
            });
            ingredientsCrees++;
          } catch {}
        }
        rapport.recettes.ingredientsCrees = ingredientsCrees;

        res.json({ success: true, data: rapport });
      } catch (e: any) {
        res.status(500).json({ success: false, message: "Erreur import: " + e.message });
      }
    });
  }
);

// GET /api/import/template — Télécharger le fichier modèle
router.get("/template", requireRole(["ADMIN", "RESPONSABLE"]), (_req: Request, res: Response) => {
  const wb = XLSX.utils.book_new();

  // ── Feuille Categories ──
  const wsCat = XLSX.utils.aoa_to_sheet([
    ["Nom", "Type", "Marge Min %"],
    ["Boulangerie", "PRODUIT", 35],
    ["Viennoiserie", "PRODUIT", 40],
    ["Pâtisserie", "PRODUIT", 45],
    ["Boissons & Snacks", "PRODUIT", 50],
    ["Farines", "MATIERE_PREMIERE", ""],
    ["Corps gras", "MATIERE_PREMIERE", ""],
    ["Sucres & édulcorants", "MATIERE_PREMIERE", ""],
    ["Produits laitiers", "MATIERE_PREMIERE", ""],
    ["Œufs", "MATIERE_PREMIERE", ""],
    ["Ferments & levures", "MATIERE_PREMIERE", ""],
    ["Additifs boulangerie", "MATIERE_PREMIERE", ""],
    ["Chocolats & garnitures", "MATIERE_PREMIERE", ""],
    ["Mélanges industriels", "MATIERE_PREMIERE", ""],
    ["Assaisonnements", "MATIERE_PREMIERE", ""],
    ["Liquides", "MATIERE_PREMIERE", ""],
    ["Céréales", "MATIERE_PREMIERE", ""],
    ["Arômes", "MATIERE_PREMIERE", ""],
  ]);
  XLSX.utils.book_append_sheet(wb, wsCat, "Categories");

  // ── Feuille Unites ──
  const wsUnites = XLSX.utils.aoa_to_sheet([
    ["Nom", "Abreviation", "Type", "Unite Base", "Coefficient"],
    ["Kilogramme", "Kg", "MASSE", "kg", 1],
    ["Gramme", "g", "MASSE", "kg", 0.001],
    ["Litre", "L", "VOLUME", "L", 1],
    ["Centilitre", "cL", "VOLUME", "L", 0.01],
    ["Pièce", "pce", "COMPTAGE", "pce", 1],
    ["Goutte", "gtt", "COMPTAGE", "gtt", 1],
    ["Pâton", "pâton", "COMPTAGE", "pâton", 1],
    ["Sachet", "sachet", "CONDITIONNEMENT", "sachet", 1],
  ]);
  XLSX.utils.book_append_sheet(wb, wsUnites, "Unites");

  // ── Feuille Matieres Premieres ──
  const wsMP = XLSX.utils.aoa_to_sheet([
    ["Nom", "Prix Achat", "Stock Actuel", "Seuil Alerte", "Stock Gere", "Categorie", "Unite"],
    ["AMELIORANT", 2824.73, 0, 5, "Oui", "Additifs boulangerie", "Kilogramme"],
    ["AMANDE EN POUDRE", 7913.47, 0, 2, "Oui", "Fruits secs & noix", "Kilogramme"],
    ["BATON BOULANGERE", 12.65, 0, 100, "Oui", "Chocolats & garnitures", "Pièce"],
    ["BEURRE CORMAN", 6838.98, 0, 5, "Oui", "Corps gras", "Kilogramme"],
    ["BEURRE PLAQUETTE", 7165.25, 0, 5, "Oui", "Corps gras", "Kilogramme"],
    ["CHOCOLAT POUR GANACHE", 4428.89, 0, 2, "Oui", "Chocolats & garnitures", "Kilogramme"],
    ["COUVERTURE SURFINE", 4187.20, 0, 2, "Oui", "Chocolats & garnitures", "Kilogramme"],
    ["CREME FRAICHE", 3289.14, 0, 2, "Oui", "Produits laitiers", "Kilogramme"],
    ["EAU", 0, 0, 0, "Non", "Liquides", "Litre"],
    ["ESSENCE EAU DE FLEUR", 2665.81, 0, 10, "Oui", "Arômes", "Goutte"],
    ["FARINE DE SEIGLE", 913.09, 0, 10, "Oui", "Farines", "Kilogramme"],
    ["FARINE MMCI", 399.04, 0, 50, "Oui", "Farines", "Kilogramme"],
    ["FARINE MOELLEUSE MMCI", 475, 0, 25, "Oui", "Farines", "Kilogramme"],
    ["FARINE VIENNOISE MMCI", 455, 0, 50, "Oui", "Farines", "Kilogramme"],
    ["FARINE COMPLETE", 480, 0, 10, "Oui", "Farines", "Kilogramme"],
    ["GELOSTELLLA CACAO MAGRO", 21074.93, 0, 1, "Oui", "Chocolats & garnitures", "Kilogramme"],
    ["GLUCOSE", 1020.40, 0, 5, "Oui", "Sucres & édulcorants", "Kilogramme"],
    ["HUILE DINOR", 1050, 0, 5, "Oui", "Corps gras", "Litre"],
    ["LAIT 26%", 3302.76, 0, 5, "Oui", "Produits laitiers", "Kilogramme"],
    ["LEVURE", 2457.60, 0, 5, "Oui", "Ferments & levures", "Kilogramme"],
    ["LEVURE SECHE SAF INSTANT", 2650, 0, 2, "Oui", "Ferments & levures", "Kilogramme"],
    ["MARGARINE OPAL 1", 1695, 0, 10, "Oui", "Corps gras", "Kilogramme"],
    ["MARGARINE OPAL 56", 2118.64, 0, 5, "Oui", "Corps gras", "Kilogramme"],
    ["MIL EN GRAIN POUR DEGUE", 2500, 0, 2, "Oui", "Céréales", "Kilogramme"],
    ["MIX BISCUIT CHOCOLAT", 2099.06, 0, 5, "Oui", "Mélanges industriels", "Kilogramme"],
    ["NEUTRO", 26112.34, 0, 1, "Oui", "Additifs boulangerie", "Kilogramme"],
    ["OEUF 40g", 2500, 0, 5, "Oui", "Œufs", "Kilogramme"],
    ["PATISY", 4171.89, 0, 5, "Oui", "Corps gras", "Kilogramme"],
    ["POUDRE A CREME", 1553.31, 0, 5, "Oui", "Mélanges industriels", "Kilogramme"],
    ["POUDRE A GENOISE MOULBIE", 1994.11, 0, 5, "Oui", "Mélanges industriels", "Kilogramme"],
    ["PROPIONATE", 5562.52, 0, 2, "Oui", "Additifs boulangerie", "Kilogramme"],
    ["SEL", 120, 0, 10, "Oui", "Assaisonnements", "Kilogramme"],
    ["SON", 80, 0, 10, "Oui", "Céréales", "Kilogramme"],
    ["SUCRE", 636.35, 0, 10, "Oui", "Sucres & édulcorants", "Kilogramme"],
    ["SUCRE GLACE", 986.67, 0, 5, "Oui", "Sucres & édulcorants", "Kilogramme"],
    ["TRIMOLINE", 2117.43, 0, 5, "Oui", "Sucres & édulcorants", "Kilogramme"],
    ["VINAIGRE BLANC ALCOOL", 923.59, 0, 2, "Oui", "Assaisonnements", "Litre"],
    ["YAOURT YOPLAIT NATURE", 1414.40, 0, 5, "Oui", "Produits laitiers", "Kilogramme"],
    ["CREMANTE BASE SORBET", 15868.91, 0, 2, "Oui", "Mélanges industriels", "Kilogramme"],
    ["RAISIN SEC", 0, 0, 2, "Oui", "Fruits secs & noix", "Kilogramme"],
  ]);
  XLSX.utils.book_append_sheet(wb, wsMP, "Matieres Premieres");

  // ── Feuille Produits ──
  const wsProduits = XLSX.utils.aoa_to_sheet([
    ["Nom", "Prix Vente", "Prix Achat", "Marge Min %", "Grammage g", "Seuil Alerte", "DLV Jours", "Semi Fini", "Categorie"],
    ["Pain Blanc 600g", 350, 0, 35, 600, 20, 1, "Non", "Boulangerie"],
    ["Pain Blanc 450g", 350, 0, 35, 450, 20, 1, "Non", "Boulangerie"],
    ["Pain Blanc 296g", 200, 0, 35, 296, 20, 1, "Non", "Boulangerie"],
    ["Pain Blanc 230g", 150, 0, 35, 230, 20, 1, "Non", "Boulangerie"],
    ["Pain Blanc 150g", 125, 0, 35, 150, 30, 1, "Non", "Boulangerie"],
    ["Pain Blanc 65g", 125, 0, 35, 65, 50, 1, "Non", "Boulangerie"],
    ["Pain Blanc 42g", 50, 0, 35, 42, 50, 1, "Non", "Boulangerie"],
    ["Pain Bis 275g", 200, 0, 35, 275, 20, 1, "Non", "Boulangerie"],
    ["Pain de Son 600g", 1200, 0, 35, 600, 10, 1, "Non", "Boulangerie"],
    ["Pain de Son 80g", 200, 0, 35, 80, 30, 1, "Non", "Boulangerie"],
    ["Pain Espagnol 450g", 350, 0, 35, 450, 10, 1, "Non", "Boulangerie"],
    ["Pain Sans Sel 450g", 350, 0, 35, 450, 10, 1, "Non", "Boulangerie"],
    ["Pain Viennois 450g", 350, 0, 35, 450, 10, 1, "Non", "Boulangerie"],
    ["Seigle 600g", 1200, 0, 35, 600, 5, 1, "Non", "Boulangerie"],
    ["Croissant Beurre Corman", 450, 0, 40, 45, 20, 1, "Non", "Viennoiserie"],
    ["Croissant Patisy", 450, 0, 40, 45, 20, 1, "Non", "Viennoiserie"],
    ["Pain Chocolat Corman", 500, 0, 40, 60, 20, 1, "Non", "Viennoiserie"],
    ["Pain Chocolat Patisy", 500, 0, 40, 60, 20, 1, "Non", "Viennoiserie"],
    ["Pain Raisin Corman", 500, 0, 40, 45, 20, 1, "Non", "Viennoiserie"],
    ["Pain Raisin Patisy", 500, 0, 40, 45, 20, 1, "Non", "Viennoiserie"],
    ["Brioche Beurre", 500, 0, 40, 60, 10, 1, "Non", "Viennoiserie"],
    ["Brioche Raisins", 450, 0, 40, 55, 10, 1, "Non", "Viennoiserie"],
    ["Madeleine", 700, 0, 45, 60, 10, 1, "Non", "Pâtisserie"],
    ["Dégué 500g", 1000, 0, 45, 500, 5, 2, "Non", "Boissons & Snacks"],
    ["Crème au Beurre", 0, 0, 0, 0, 2, 3, "Oui", "Pâtisserie"],
    ["Crème Pâtissière", 0, 0, 0, 0, 2, 2, "Oui", "Pâtisserie"],
    ["Ganache Alibi", 0, 0, 0, 0, 1, 3, "Oui", "Pâtisserie"],
    ["Ganache Chocolat Noir", 0, 0, 0, 0, 1, 3, "Oui", "Pâtisserie"],
    ["Pâte Salée", 0, 0, 0, 0, 1, 2, "Oui", "Pâtisserie"],
    ["Pâte Sucrée", 0, 0, 0, 0, 1, 2, "Oui", "Pâtisserie"],
  ]);
  XLSX.utils.book_append_sheet(wb, wsProduits, "Produits");

  // ── Feuille Recettes ──
  const wsRecettes = XLSX.utils.aoa_to_sheet([
    ["Nom", "Ratio Pate", "Taux Perte %", "Est Viennoiserie", "Ingredient Reference", "Ingredient Reference Nom", "Ingredient Reference Unite", "Description"],
    ["Pain Blanc", 1.63, 12, "Non", "FARINE", "Farine MMCI", "kg", "Pain blanc classique"],
    ["Pain Bis", 1.78, 12, "Non", "FARINE", "Farine MMCI", "kg", "Pain bis avec son"],
    ["Pain de Son", 2.06, 12, "Non", "FARINE", "Farine MMCI", "kg", "Pain de son jour et nuit"],
    ["Pain Espagnol", 1.65, 12, "Non", "FARINE", "Farine MMCI", "kg", "Pain espagnol à l'huile"],
    ["Pain Sans Sel", 1.77, 12, "Non", "FARINE", "Farine MMCI", "kg", "Pain sans sel pour régimes"],
    ["Pain Viennois", 1.79, 12, "Non", "FARINE", "Farine MMCI", "kg", "Pain viennois au lait"],
    ["Seigle", 2.13, 12, "Non", "FARINE", "Farine MMCI", "kg", "Pain de seigle"],
    ["Pâte Viennoise", 1.86, 5, "Oui", "FARINE", "Farine Viennoise MMCI", "kg", "Base viennoiserie — croissants pains chocolat raisins"],
    ["Brioche Beurre", 1.0, 10, "Oui", "FARINE", "Farine MMCI", "kg", "Brioche au beurre"],
    ["Brioche Raisins", 1.93, 10, "Oui", "FARINE", "Farine MMCI", "kg", "Brioche aux raisins"],
    ["Crème au Beurre", 1.0, 0, "Non", "OEUFS", "Œufs", "kg", "Semi-fini — crème décoration"],
    ["Crème Pâtissière", 1.0, 0, "Non", "EAU", "Eau", "L", "Semi-fini — fourrage"],
    ["Ganache Alibi", 1.0, 0, "Non", "CHOCOLAT", "Chocolat", "kg", "Ganache légère"],
    ["Ganache Chocolat Noir", 1.0, 0, "Non", "CHOCOLAT", "Chocolat", "kg", "Ganache intense"],
    ["Pâte Salée", 1.0, 0, "Non", "FARINE", "Farine MMCI", "kg", "Base quiches"],
    ["Pâte Sucrée", 1.0, 0, "Non", "FARINE", "Farine MMCI", "kg", "Base tartes sucrées"],
    ["Madeleine", 1.0, 15, "Non", "FARINE", "Farine MMCI", "kg", "Madeleines"],
    ["Dégué", 1.0, 0, "Non", "LAIT", "Lait 26%", "kg", "Boisson dégué"],
  ]);
  XLSX.utils.book_append_sheet(wb, wsRecettes, "Recettes");

  // ── Feuille Ingredients Recettes ──
  const wsIng = XLSX.utils.aoa_to_sheet([
    ["Recette", "Matiere Premiere", "Quantite par kg ref", "Unite"],
    // Pain Blanc (par kg farine)
    ["Pain Blanc", "AMELIORANT", 0.003, "Kilogramme"],
    ["Pain Blanc", "FARINE MMCI", 1, "Kilogramme"],
    ["Pain Blanc", "LEVURE", 0.005, "Kilogramme"],
    ["Pain Blanc", "EAU", 0.6, "Litre"],
    ["Pain Blanc", "SEL", 0.02, "Kilogramme"],
    // Pain Bis
    ["Pain Bis", "AMELIORANT", 0.004, "Kilogramme"],
    ["Pain Bis", "FARINE MMCI", 1, "Kilogramme"],
    ["Pain Bis", "LEVURE", 0.005, "Kilogramme"],
    ["Pain Bis", "EAU", 0.7, "Litre"],
    ["Pain Bis", "SEL", 0.02, "Kilogramme"],
    ["Pain Bis", "SON", 0.05, "Kilogramme"],
    // Pain de Son
    ["Pain de Son", "AMELIORANT", 0.008, "Kilogramme"],
    ["Pain de Son", "FARINE MMCI", 1, "Kilogramme"],
    ["Pain de Son", "LEVURE", 0.006, "Kilogramme"],
    ["Pain de Son", "EAU", 0.82, "Litre"],
    ["Pain de Son", "SEL", 0.025, "Kilogramme"],
    ["Pain de Son", "SON", 0.2, "Kilogramme"],
    ["Pain de Son", "PROPIONATE", 0.005, "Kilogramme"],
    // Pain Espagnol
    ["Pain Espagnol", "AMELIORANT", 0.004, "Kilogramme"],
    ["Pain Espagnol", "FARINE MMCI", 1, "Kilogramme"],
    ["Pain Espagnol", "LEVURE", 0.007, "Kilogramme"],
    ["Pain Espagnol", "EAU", 0.5, "Litre"],
    ["Pain Espagnol", "HUILE DINOR", 0.1, "Litre"],
    ["Pain Espagnol", "SEL", 0.02, "Kilogramme"],
    ["Pain Espagnol", "SUCRE", 0.02, "Kilogramme"],
    // Pain Sans Sel
    ["Pain Sans Sel", "AMELIORANT", 0.004, "Kilogramme"],
    ["Pain Sans Sel", "FARINE MMCI", 1, "Kilogramme"],
    ["Pain Sans Sel", "LEVURE", 0.008, "Kilogramme"],
    ["Pain Sans Sel", "MARGARINE OPAL 1", 0.15, "Kilogramme"],
    ["Pain Sans Sel", "EAU", 0.6, "Litre"],
    ["Pain Sans Sel", "PROPIONATE", 0.005, "Kilogramme"],
    // Pain Viennois
    ["Pain Viennois", "AMELIORANT", 0.004, "Kilogramme"],
    ["Pain Viennois", "FARINE MMCI", 1, "Kilogramme"],
    ["Pain Viennois", "LEVURE", 0.007, "Kilogramme"],
    ["Pain Viennois", "EAU", 0.55, "Litre"],
    ["Pain Viennois", "HUILE DINOR", 0.1, "Litre"],
    ["Pain Viennois", "LAIT 26%", 0.05, "Kilogramme"],
    ["Pain Viennois", "SEL", 0.02, "Kilogramme"],
    ["Pain Viennois", "SUCRE", 0.06, "Kilogramme"],
    // Seigle
    ["Seigle", "AMELIORANT", 0.0062, "Kilogramme"],
    ["Seigle", "FARINE MMCI", 0.769, "Kilogramme"],
    ["Seigle", "LEVURE", 0.018, "Kilogramme"],
    ["Seigle", "PROPIONATE", 0.0074, "Kilogramme"],
    ["Seigle", "EAU", 0.796, "Litre"],
    ["Seigle", "SEL", 0.0185, "Kilogramme"],
    ["Seigle", "SON", 0.1296, "Kilogramme"],
    ["Seigle", "FARINE DE SEIGLE", 0.2315, "Kilogramme"],
    // Pâte Viennoise (par kg farine viennoise)
    ["Pâte Viennoise", "FARINE VIENNOISE MMCI", 1, "Kilogramme"],
    ["Pâte Viennoise", "EAU", 0.66, "Litre"],
    ["Pâte Viennoise", "LEVURE", 0.0086, "Kilogramme"],
    ["Pâte Viennoise", "MARGARINE OPAL 1", 0.05, "Kilogramme"],
    ["Pâte Viennoise", "SUCRE", 0.12, "Kilogramme"],
    ["Pâte Viennoise", "SEL", 0.02, "Kilogramme"],
    ["Pâte Viennoise", "AMELIORANT", 0.005, "Kilogramme"],
    // Brioche Beurre (par kg farine)
    ["Brioche Beurre", "BEURRE PLAQUETTE", 0.2, "Kilogramme"],
    ["Brioche Beurre", "LEVURE", 0.02, "Kilogramme"],
    ["Brioche Beurre", "FARINE MMCI", 1, "Kilogramme"],
    ["Brioche Beurre", "OEUF 40g", 0.32, "Kilogramme"],
    ["Brioche Beurre", "EAU", 0.264, "Litre"],
    ["Brioche Beurre", "SEL", 0.02, "Kilogramme"],
    ["Brioche Beurre", "SUCRE", 0.2, "Kilogramme"],
    // Crème au Beurre
    ["Crème au Beurre", "BEURRE PLAQUETTE", 12.6, "Kilogramme"],
    ["Crème au Beurre", "EAU", 2.5, "Litre"],
    ["Crème au Beurre", "GLUCOSE", 1, "Kilogramme"],
    ["Crème au Beurre", "OEUF 40g", 3.2, "Kilogramme"],
    ["Crème au Beurre", "MARGARINE OPAL 1", 1.5, "Kilogramme"],
    ["Crème au Beurre", "SUCRE", 10, "Kilogramme"],
    // Crème Pâtissière
    ["Crème Pâtissière", "EAU", 30, "Litre"],
    ["Crème Pâtissière", "LAIT 26%", 3, "Kilogramme"],
    ["Crème Pâtissière", "POUDRE A CREME", 3.5, "Kilogramme"],
    ["Crème Pâtissière", "SUCRE", 4.5, "Kilogramme"],
    // Ganache Alibi
    ["Ganache Alibi", "CHOCOLAT POUR GANACHE", 0.8, "Kilogramme"],
    ["Ganache Alibi", "CREME FRAICHE", 1, "Kilogramme"],
    // Ganache Chocolat Noir
    ["Ganache Chocolat Noir", "BEURRE PLAQUETTE", 2.4, "Kilogramme"],
    ["Ganache Chocolat Noir", "EAU", 12, "Litre"],
    ["Ganache Chocolat Noir", "LAIT 26%", 1.2, "Kilogramme"],
    ["Ganache Chocolat Noir", "CHOCOLAT POUR GANACHE", 30, "Kilogramme"],
    // Madeleine
    ["Madeleine", "OEUF 40g", 0.6, "Kilogramme"],
    ["Madeleine", "BEURRE PLAQUETTE", 0.6, "Kilogramme"],
    ["Madeleine", "FARINE MMCI", 1.37, "Kilogramme"],
    ["Madeleine", "LEVURE", 0.05, "Kilogramme"],
    ["Madeleine", "LAIT 26%", 0.06, "Kilogramme"],
    ["Madeleine", "EAU", 0.56, "Litre"],
    ["Madeleine", "SUCRE", 0.87, "Kilogramme"],
    ["Madeleine", "TRIMOLINE", 0.12, "Kilogramme"],
    // Dégué
    ["Dégué", "EAU", 1, "Litre"],
    ["Dégué", "LAIT 26%", 0.225, "Kilogramme"],
    ["Dégué", "YAOURT YOPLAIT NATURE", 0.125, "Kilogramme"],
    ["Dégué", "SUCRE GLACE", 0.2, "Kilogramme"],
    ["Dégué", "MIL EN GRAIN POUR DEGUE", 0.12, "Kilogramme"],
  ]);
  XLSX.utils.book_append_sheet(wb, wsIng, "Ingredients Recettes");

  // ── Feuille Notice ──
  const wsNotice = XLSX.utils.aoa_to_sheet([
    ["DÉLICE PRO — FICHIER D'IMPORT"],
    [""],
    ["INSTRUCTIONS"],
    ["1. Ne pas supprimer ni renommer les feuilles"],
    ["2. Ne pas modifier les en-têtes (ligne 1)"],
    ["3. Remplir dans l'ordre : Categories → Unites → Matieres Premieres → Produits → Recettes → Ingredients Recettes"],
    ["4. Les noms doivent être identiques dans toutes les feuilles (ex: 'FARINE MMCI' partout)"],
    ["5. Champs Oui/Non : écrire exactement Oui ou Non"],
    ["6. Les décimales avec point : 0.005 (pas virgule)"],
    [""],
    ["TYPES AUTORISÉS"],
    ["Categorie Type    : PRODUIT ou MATIERE_PREMIERE"],
    ["Unite Type        : MASSE, VOLUME, COMPTAGE ou CONDITIONNEMENT"],
    ["Est Viennoiserie  : Oui ou Non"],
    ["Semi Fini         : Oui ou Non"],
    [""],
    ["CATÉGORIES PRODUCTION"],
    ["BOULANGERIE             : pains classiques — produits finis le jour même"],
    ["VIENNOISERIE_PETRISSAGE : pâte viennoise — crée des pâtons en chambre froide"],
    ["VIENNOISERIE_FACONNAGE  : façonnage des pâtons — crée les produits finis"],
    ["PATISSERIE              : gâteaux, semi-finis, glaces"],
  ]);
  XLSX.utils.book_append_sheet(wb, wsNotice, "NOTICE");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=DelicePro_Import_Template.xlsx");
  res.send(buf);
});


// ─── Import individuel par module ────────────────────────────

// POST /api/import/categories
router.post("/categories", requireRole(["ADMIN", "RESPONSABLE"]),
  (req: Request, res: Response) => {
    upload.single("fichier")(req, res, async (err) => {
      if (err || !req.file) return res.status(400).json({ success: false, message: "Fichier invalide" });
      const companyId = req.user!.companyId;
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const rows = sheetToRows(wb, wb.SheetNames[0]);
      let crees = 0; const erreurs: string[] = [];
      for (const row of rows) {
        const nom = str(row["Nom"] ?? row["nom"] ?? Object.values(row)[0]);
        const type = str(row["Type"] ?? row["type"] ?? Object.values(row)[1]).toUpperCase();
        const margeMin = num(row["Marge Min %"] ?? row["margeMin"] ?? 0);
        if (!nom || !["PRODUIT","MATIERE_PREMIERE"].includes(type)) {
          if (nom) erreurs.push(`"${nom}" : type invalide (PRODUIT ou MATIERE_PREMIERE)`); continue;
        }
        try {
          const existing = await prisma.categorie.findFirst({ where: { nom, companyId } });
          if (!existing) { await prisma.categorie.create({ data: { nom, type: type as any, margeMin: margeMin || null, companyId } }); crees++; }
        } catch (e: any) { erreurs.push(`"${nom}" : ${e.message}`); }
      }
      res.json({ success: true, data: { crees, erreurs } });
    });
  }
);

// POST /api/import/unites
router.post("/unites", requireRole(["ADMIN", "RESPONSABLE"]),
  (req: Request, res: Response) => {
    upload.single("fichier")(req, res, async (err) => {
      if (err || !req.file) return res.status(400).json({ success: false, message: "Fichier invalide" });
      const companyId = req.user!.companyId;
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const rows = sheetToRows(wb, wb.SheetNames[0]);
      let crees = 0; const erreurs: string[] = [];
      for (const row of rows) {
        const nom = str(row["Nom"] ?? row["nom"]);
        const abreviation = str(row["Abreviation"] ?? row["Abréviation"] ?? row["abreviation"]);
        const type = str(row["Type"] ?? row["type"]).toUpperCase();
        const uniteBase = str(row["Unite Base"] ?? row["uniteBase"]) || abreviation;
        const coefficient = num(row["Coefficient"] ?? row["coefficient"]) || 1;
        if (!nom || !abreviation || !["MASSE","VOLUME","COMPTAGE","CONDITIONNEMENT"].includes(type)) {
          if (nom) erreurs.push(`"${nom}" : données incomplètes`); continue;
        }
        try {
          const existing = await prisma.unite.findFirst({ where: { nom, companyId } });
          if (!existing) { await prisma.unite.create({ data: { nom, abreviation, type: type as any, uniteBase, coefficient, companyId } }); crees++; }
        } catch (e: any) { erreurs.push(`"${nom}" : ${e.message}`); }
      }
      res.json({ success: true, data: { crees, erreurs } });
    });
  }
);

// POST /api/import/mp
router.post("/mp", requireRole(["ADMIN", "RESPONSABLE"]),
  (req: Request, res: Response) => {
    upload.single("fichier")(req, res, async (err) => {
      if (err || !req.file) return res.status(400).json({ success: false, message: "Fichier invalide" });
      const companyId = req.user!.companyId;
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const rows = sheetToRows(wb, wb.SheetNames[0]);
      let crees = 0; const erreurs: string[] = [];
      for (const row of rows) {
        const nom = str(row["Nom"] ?? row["nom"]);
        const prixAchat = num(row["Prix Achat"] ?? row["prixAchat"]);
        const stockActuel = num(row["Stock Actuel"] ?? row["stockActuel"]);
        const seuilAlerte = num(row["Seuil Alerte"] ?? row["seuilAlerte"]);
        const stockGere = str(row["Stock Gere"] ?? row["stockGere"] ?? "Oui").toLowerCase() !== "non";
        const categorieNom = str(row["Categorie"] ?? row["categorie"]);
        const uniteNom = str(row["Unite"] ?? row["unite"]);
        if (!nom) continue;
        try {
          const existing = await prisma.matierePremiere.findFirst({ where: { nom, companyId, actif: true } });
          if (existing) continue;
          let categorieId: string | undefined;
          let uniteId: string | undefined;
          if (categorieNom) { const cat = await prisma.categorie.findFirst({ where: { nom: categorieNom, companyId } }); if (cat) categorieId = cat.id; }
          if (uniteNom) { const u = await prisma.unite.findFirst({ where: { nom: { contains: uniteNom }, companyId } }); if (u) uniteId = u.id; }
          await prisma.matierePremiere.create({ data: { nom, prixAchat, stockActuel, seuilAlerte, stockGere, categorieId, uniteId, companyId } });
          crees++;
        } catch (e: any) { erreurs.push(`"${nom}" : ${e.message}`); }
      }
      res.json({ success: true, data: { crees, erreurs } });
    });
  }
);

// POST /api/import/produits
router.post("/produits", requireRole(["ADMIN", "RESPONSABLE"]),
  (req: Request, res: Response) => {
    upload.single("fichier")(req, res, async (err) => {
      if (err || !req.file) return res.status(400).json({ success: false, message: "Fichier invalide" });
      const companyId = req.user!.companyId;
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const rows = sheetToRows(wb, wb.SheetNames[0]);
      let crees = 0; const erreurs: string[] = [];
      for (const row of rows) {
        const nom = str(row["Nom"] ?? row["nom"]);
        const prixVente = num(row["Prix Vente"] ?? row["prixVente"]);
        const prixAchat = num(row["Prix Achat"] ?? row["prixAchat"]);
        const margeMin = num(row["Marge Min %"] ?? row["margeMin"]) || 25;
        const grammage = num(row["Grammage g"] ?? row["grammage"]) || null;
        const seuilAlerte = num(row["Seuil Alerte"] ?? row["seuilAlerte"]) || 10;
        const dlvJours = num(row["DLV Jours"] ?? row["dlvJours"]) || 1;
        const estSemiFini = bool(row["Semi Fini"] ?? row["estSemiFini"]);
        const categorieNom = str(row["Categorie"] ?? row["categorie"]);
        if (!nom || !prixVente) { if (nom) erreurs.push(`"${nom}" : prix vente manquant`); continue; }
        try {
          const existing = await prisma.produit.findFirst({ where: { nom, companyId, actif: true } });
          if (existing) continue;
          let categorieId: string | undefined;
          if (categorieNom) { const cat = await prisma.categorie.findFirst({ where: { nom: categorieNom, companyId } }); if (cat) categorieId = cat.id; }
          await (prisma.produit.create as any)({ data: { nom, prixVente, prixAchat, margeMin, grammage, seuilAlerte, dlvJours, estSemiFini, categorieId, companyId } });
          crees++;
        } catch (e: any) { erreurs.push(`"${nom}" : ${e.message}`); }
      }
      res.json({ success: true, data: { crees, erreurs } });
    });
  }
);

// POST /api/import/recettes
router.post("/recettes", requireRole(["ADMIN", "RESPONSABLE"]),
  (req: Request, res: Response) => {
    upload.single("fichier")(req, res, async (err) => {
      if (err || !req.file) return res.status(400).json({ success: false, message: "Fichier invalide" });
      const companyId = req.user!.companyId;
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const rows = sheetToRows(wb, wb.SheetNames[0]);
      let crees = 0; let ingredientsCrees = 0; const erreurs: string[] = [];

      for (const row of rows) {
        const nom = str(row["Nom"] ?? row["nom"]);
        const ratioPate = num(row["Ratio Pate"] ?? row["ratioPate"]) || 1;
        const tauxPerte = num(row["Taux Perte %"] ?? row["tauxPerte"]);
        const estViennoiserie = bool(row["Est Viennoiserie"] ?? row["estViennoiserie"]);
        const ingredientReference = str(row["Ingredient Reference"] ?? row["ingredientReference"]) || "FARINE";
        const ingredientReferenceNom = str(row["Ingredient Reference Nom"] ?? row["ingredientReferenceNom"]) || "Farine";
        const ingredientReferenceUnite = str(row["Ingredient Reference Unite"] ?? row["ingredientReferenceUnite"]) || "kg";
        const description = str(row["Description"] ?? row["description"]);
        if (!nom) continue;
        try {
          const existing = await prisma.recette.findFirst({ where: { nom, companyId } });
          if (!existing) {
            await (prisma.recette.create as any)({ data: { nom, ratioPate, tauxPerte, estViennoiserie, ingredientReference, ingredientReferenceNom, ingredientReferenceUnite, description: description || null, companyId } });
            crees++;
          }
        } catch (e: any) { erreurs.push(`"${nom}" : ${e.message}`); }
      }
      res.json({ success: true, data: { crees, ingredientsCrees, erreurs } });
    });
  }
);

// POST /api/import/ingredients
router.post("/ingredients", requireRole(["ADMIN", "RESPONSABLE"]),
  (req: Request, res: Response) => {
    upload.single("fichier")(req, res, async (err) => {
      if (err || !req.file) return res.status(400).json({ success: false, message: "Fichier invalide" });
      const companyId = req.user!.companyId;
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const rows = sheetToRows(wb, wb.SheetNames[0]);
      let crees = 0; const erreurs: string[] = [];
      for (const row of rows) {
        const recetteNom = str(row["Recette"] ?? row["recette"]);
        const mpNom = str(row["Matiere Premiere"] ?? row["matierePremiere"]);
        const quantite = num(row["Quantite par kg ref"] ?? row["quantite"]);
        const uniteNom = str(row["Unite"] ?? row["unite"]);
        if (!recetteNom || !mpNom || !quantite) continue;
        try {
          const recette = await prisma.recette.findFirst({ where: { nom: recetteNom, companyId } });
          const mp = await prisma.matierePremiere.findFirst({ where: { nom: mpNom, companyId, actif: true } });
          if (!recette || !mp) { erreurs.push(`"${recetteNom}/${mpNom}" : recette ou MP introuvable`); continue; }
          const existing = await prisma.recetteIngredient.findFirst({ where: { recetteId: recette.id, mpId: mp.id } });
          if (existing) continue;
          let uniteId: string | undefined;
          if (uniteNom) { const u = await prisma.unite.findFirst({ where: { nom: { contains: uniteNom }, companyId } }); if (u) uniteId = u.id; }
          await prisma.recetteIngredient.create({ data: { recetteId: recette.id, mpId: mp.id, quantite, uniteId } });
          crees++;
        } catch (e: any) { erreurs.push(`"${recetteNom}/${mpNom}" : ${e.message}`); }
      }
      res.json({ success: true, data: { crees, erreurs } });
    });
  }
);

// GET /api/import/template/:module — Télécharger modèle par module
router.get("/template/:module", requireRole(["ADMIN", "RESPONSABLE"]), (_req: Request, res: Response) => {
  const module = _req.params.module;
  const wb = XLSX.utils.book_new();

  const templates: Record<string, any[][]> = {
    categories: [
      ["Nom", "Type", "Marge Min %"],
      ["Boulangerie", "PRODUIT", 35],
      ["Viennoiserie", "PRODUIT", 40],
      ["Farines", "MATIERE_PREMIERE", ""],
      ["Corps gras", "MATIERE_PREMIERE", ""],
    ],
    unites: [
      ["Nom", "Abreviation", "Type", "Unite Base", "Coefficient"],
      ["Kilogramme", "Kg", "MASSE", "kg", 1],
      ["Litre", "L", "VOLUME", "L", 1],
      ["Pièce", "pce", "COMPTAGE", "pce", 1],
    ],
    mp: [
      ["Nom", "Prix Achat", "Stock Actuel", "Seuil Alerte", "Stock Gere", "Categorie", "Unite"],
      ["FARINE MMCI", 399.04, 0, 50, "Oui", "Farines", "Kilogramme"],
      ["EAU", 0, 0, 0, "Non", "Liquides", "Litre"],
    ],
    produits: [
      ["Nom", "Prix Vente", "Prix Achat", "Marge Min %", "Grammage g", "Seuil Alerte", "DLV Jours", "Semi Fini", "Categorie"],
      ["Pain Blanc 600g", 350, 0, 35, 600, 20, 1, "Non", "Boulangerie"],
      ["Crème au Beurre", 0, 0, 0, 0, 2, 3, "Oui", "Pâtisserie"],
    ],
    recettes: [
      ["Nom", "Ratio Pate", "Taux Perte %", "Est Viennoiserie", "Ingredient Reference", "Ingredient Reference Nom", "Ingredient Reference Unite", "Description"],
      ["Pain Blanc", 1.63, 12, "Non", "FARINE", "Farine MMCI", "kg", "Pain blanc classique"],
      ["Pâte Viennoise", 1.86, 5, "Oui", "FARINE", "Farine Viennoise MMCI", "kg", "Base croissants"],
    ],
    ingredients: [
      ["Recette", "Matiere Premiere", "Quantite par kg ref", "Unite"],
      ["Pain Blanc", "FARINE MMCI", 1, "Kilogramme"],
      ["Pain Blanc", "EAU", 0.6, "Litre"],
      ["Pain Blanc", "LEVURE", 0.005, "Kilogramme"],
    ],
  };

  const data = templates[module];
  if (!data) return res.status(404).json({ success: false, message: "Module inconnu" });

  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, module);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=modele_${module}.xlsx`);
  res.send(buf);
});


export default router;