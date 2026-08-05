"use strict";
// src/modules/production/production.routes.ts
//
// NOUVEAU FLUX : Plus de /demarrer + /finaliser séparés
// → Un seul endpoint POST /enregistrer
//   Le boulanger saisit tout en fin de pétrin en une fois
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const database_1 = __importDefault(require("../../config/database"));
const production_service_1 = require("./production.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// ─── GET /api/production — Historique ────────────────────────────────────────
router.get("/", async (req, res) => {
    const { categorieProd, sessionProd, dateDebut, dateFin } = req.query;
    const result = await (0, production_service_1.getProductions)(req.user.companyId, {
        categorieProd: categorieProd,
        sessionProd: sessionProd,
        dateDebut: dateDebut,
        dateFin: dateFin,
    });
    res.json({ success: true, data: result });
});
// ─── GET /api/production/prochain-numero ─────────────────────────────────────
// Retourne le prochain numéro de pétrin pour la journée (= dernier + 1)
router.get("/prochain-numero", async (req, res) => {
    const numero = await (0, production_service_1.getProchainNumeroPetrin)(req.user.companyId);
    res.json({ success: true, data: { numeroPetrin: numero } });
});
// ─── GET /api/production/lots — Lots de stock actifs ─────────────────────────
// Retourne tous les lots actifs avec leur date d'expiration
// Utilisé par la page Stocks et la Clôture
router.get("/lots", async (req, res) => {
    const { produitId } = req.query;
    const result = await (0, production_service_1.getLotsActifs)(req.user.companyId, produitId);
    res.json({ success: true, data: result });
});
// ─── GET /api/production/patons — Pâtons en chambre froide ───────────────────
router.get("/patons", async (req, res) => {
    const result = await (0, production_service_1.getPatonsEnChambreFroide)(req.user.companyId);
    res.json({ success: true, data: result });
});
// ─── GET /api/production/derniere-retournee — Alerte pâte retournée ──────────
router.get("/derniere-retournee", async (req, res) => {
    const result = await (0, production_service_1.getDerniereRetournee)(req.user.companyId);
    res.json({ success: true, data: result });
});
// ─── GET /api/production/recette-info — Infos recette pour formulaire ────────
// Retourne les ingrédients avec quantités pour une farine donnée
// Utilisé pour afficher le tableau d'ingrédients pendant la saisie
router.get("/recette-info", async (req, res) => {
    const { recetteId, quantiteFarine } = req.query;
    if (!recetteId) {
        res.status(400).json({ success: false, message: "recetteId requis" });
        return;
    }
    const recette = await database_1.default.recette.findFirst({
        where: { id: recetteId, companyId: req.user.companyId },
        include: {
            ingredients: {
                include: {
                    mp: { select: { id: true, nom: true, prixAchat: true, stockActuel: true, stockGere: true } },
                    unite: { select: { abreviation: true, coefficient: true } },
                },
            },
        },
    });
    if (!recette) {
        res.status(404).json({ success: false, message: "Recette introuvable" });
        return;
    }
    const farine = Number(quantiteFarine ?? 50);
    // Calculer les quantités pour ce volume de farine
    const ingredients = recette.ingredients.map(ing => {
        const coeff = ing.unite?.coefficient ?? 1;
        const quantite = Math.round(ing.quantite * farine * coeff * 1000) / 1000;
        const nonGere = ing.mp.stockGere === false;
        const manquant = !nonGere && ing.mp.stockActuel < quantite;
        return {
            nom: ing.mp.nom,
            quantite,
            unite: ing.unite?.abreviation ?? "kg",
            nonGere,
            stockActuel: ing.mp.stockActuel,
            manquant,
            manque: manquant ? Math.round((quantite - ing.mp.stockActuel) * 1000) / 1000 : 0,
        };
    });
    // Pâte théorique
    const pateRecuperee = Number(req.query.pateRecuperee ?? 0);
    const pateTheorique = Math.round((recette.ratioPate * farine + pateRecuperee) * 100) / 100;
    res.json({
        success: true,
        data: {
            recette: {
                nom: recette.nom,
                ratioPate: recette.ratioPate,
                tauxPerte: recette.tauxPerte,
                ingredientReference: recette.ingredientReference ?? "FARINE",
                ingredientReferenceNom: recette.ingredientReferenceNom ?? "Farine",
                ingredientReferenceUnite: recette.ingredientReferenceUnite ?? "kg",
            },
            ingredients,
            pateTheorique,
            alertesStock: ingredients.filter(i => i.manquant),
        },
    });
});
// ─── POST /api/production/enregistrer — Enregistrer un pétrin complet ────────
// Nouveau endpoint unique : remplace /demarrer + /finaliser
// Le boulanger saisit tout en fin de pétrin
router.post("/enregistrer", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "CHEF_PATISSIER"]), async (req, res) => {
    const data = production_service_1.enregistrerProductionSchema.parse(req.body);
    // CORRECTION 🔴 : Vérifier stock MP suffisant avant de créer le pétrin
    // Empêche une production fictive si les ingrédients manquent
    const recetteCheck = await database_1.default.recette.findUnique({
        where: { id: data.recetteId },
        include: {
            ingredients: {
                include: { mp: { select: { id: true, nom: true, stockActuel: true, stockGere: true, unite: { select: { abreviation: true } } } } },
            },
        },
    });
    if (recetteCheck) {
        const farine = data.quantiteFarine;
        for (const ing of recetteCheck.ingredients) {
            if (ing.mp.stockGere === false)
                continue;
            const qteNecessaire = Math.round(ing.quantite * farine * 1000) / 1000;
            const stockDispo = ing.mp.stockActuel ?? 0;
            if (stockDispo < qteNecessaire) {
                res.status(400).json({
                    success: false,
                    message: `Stock insuffisant pour "${ing.mp.nom}" : ` +
                        `besoin de ${qteNecessaire} ${ing.mp.unite?.abreviation ?? "kg"}, ` +
                        `disponible ${stockDispo} ${ing.mp.unite?.abreviation ?? "kg"}. ` +
                        `Approvisionnez-vous avant de lancer ce pétrin.`,
                });
                return;
            }
        }
    }
    const result = await (0, production_service_1.enregistrerProduction)(req.user.companyId, req.user.id, data);
    // AJOUT : Après production, vérifier les commandes EN_PRODUCTION débloquées
    // On cherche les commandes dont tous les produits sont maintenant en stock suffisant
    try {
        const companyId = req.user.companyId;
        // Récupérer toutes les commandes en attente (RECUE ou EN_PRODUCTION)
        const commandesEnAttente = await database_1.default.commandeClient.findMany({
            where: {
                companyId,
                statut: { in: ["RECUE", "EN_PRODUCTION"] },
            },
            include: {
                client: { select: { nom: true } },
                lignes: {
                    include: {
                        produit: { select: { id: true, nom: true, stockActuel: true } },
                    },
                },
            },
        });
        // Vérifier lesquelles sont maintenant satisfaites
        const commandesDebloquees = commandesEnAttente.filter(cmd => {
            return cmd.lignes.every(l => {
                const stock = l.produit?.stockActuel ?? 0;
                return stock >= l.quantite;
            });
        });
        // Retourner les commandes débloquées avec le résultat de production
        res.status(201).json({
            success: true,
            data: {
                ...result,
                // AJOUT : liste des commandes maintenant satisfaisables
                commandesDebloquees: commandesDebloquees.map(cmd => ({
                    id: cmd.id,
                    reference: cmd.reference,
                    clientNom: cmd.client?.nom ?? "—",
                    dateLivraison: cmd.dateLivraison,
                    montantTotal: cmd.montantTotal,
                    statut: cmd.statut,
                    nbProduits: cmd.lignes.length,
                })),
            },
        });
    }
    catch {
        // Si la vérification échoue, on retourne quand même le résultat de production
        res.status(201).json({ success: true, data: result });
    }
});
// ─── POST /api/production/patons/faconner ────────────────────────────────────
router.post("/patons/faconner", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "CHEF_PATISSIER"]), async (req, res) => {
    const data = production_service_1.faconnerPatonSchema.parse(req.body);
    const result = await (0, production_service_1.faconnerPaton)(req.user.companyId, data);
    res.json({ success: true, data: result });
});
// ─── PUT /api/production/patons/:id/perdu ────────────────────────────────────
router.put("/patons/:id/perdu", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "CHEF_PATISSIER"]), async (req, res) => {
    const { companyId } = req.user;
    const paton = await database_1.default.paton.findFirst({
        where: { id: req.params.id, companyId, statutPaton: "EN_CHAMBRE_FROIDE" },
        include: {
            production: {
                include: {
                    recette: {
                        include: {
                            ingredients: {
                                include: {
                                    mp: { select: { id: true, nom: true, prixAchat: true, stockGere: true } },
                                    unite: { select: { coefficient: true } },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!paton) {
        res.status(404).json({ success: false, message: "Pâton introuvable" });
        return;
    }
    const pateEffective = paton.production.pateEffective || 1;
    const ratioPerte = paton.poids / pateEffective;
    for (const ing of paton.production.recette.ingredients) {
        if (ing.mp.stockGere === false)
            continue;
        const coeff = ing.unite?.coefficient ?? 1;
        const qtePer = Math.round(ing.quantite * paton.production.quantiteFarine * coeff * ratioPerte * 1000) / 1000;
        if (qtePer <= 0)
            continue;
        await database_1.default.perte.create({
            data: {
                companyId, type: "MATIERE_PREMIERE", mpId: ing.mp.id,
                quantite: qtePer,
                valeur: Math.round(qtePer * ing.mp.prixAchat * 100) / 100,
                cause: "Pâton perdu (chambre froide)",
                deductMP: false, date: new Date(),
                notes: `Pâton ${paton.poids} kg — Pétrin #${paton.production.numeroPetrin}`,
            },
        });
    }
    await database_1.default.paton.update({
        where: { id: req.params.id },
        data: { statutPaton: "PERDU" },
    });
    res.json({ success: true, data: { message: `Pâton déclaré perdu. Pertes MP enregistrées.` } });
});
// ─── GET /api/production/:id — Détail complet d'un pétrin ───────────────────
router.get("/:id", async (req, res) => {
    const { companyId } = req.user;
    const production = await database_1.default.production.findFirst({
        where: { id: req.params.id, companyId },
        include: {
            recette: { select: {
                    id: true, nom: true, ratioPate: true, tauxPerte: true,
                    ingredientReferenceNom: true, ingredientReferenceUnite: true,
                    ingredients: {
                        include: {
                            mp: { select: { id: true, nom: true, prixAchat: true } },
                            unite: { select: { abreviation: true } },
                        },
                    },
                } },
            user: { select: { prenom: true, nom: true } },
            lignesProduction: {
                include: { produit: { select: { id: true, nom: true, prixVente: true, grammage: true } } },
            },
            patons: true,
            lotsStock: {
                include: { produit: { select: { nom: true } } },
            },
        },
    });
    if (!production) {
        res.status(404).json({ success: false, message: "Pétrin introuvable" });
        return;
    }
    res.json({ success: true, data: production });
});
// POST /api/production/patons/faconner-lot — Façonner TOUS les pâtons d'un lot (même recette+poids)
router.post("/patons/faconner-lot", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "CHEF_PATISSIER"]), async (req, res) => {
    const schema = zod_1.z.object({
        productionId: zod_1.z.string(),
        poids: zod_1.z.number().positive(),
        produitId: zod_1.z.string(),
        poidsBeurre: zod_1.z.number().min(0).default(0),
        beurreMP: zod_1.z.string().optional(), // ID MP beurre utilisé
        nbPiecesParPaton: zod_1.z.number().int().positive(),
        nbPatons: zod_1.z.number().int().positive().optional(),
    });
    const data = schema.parse(req.body);
    const { companyId } = req.user;
    // Récupérer tous les pâtons du lot (même production + même poids + EN_CHAMBRE_FROIDE)
    const patons = await database_1.default.paton.findMany({
        where: {
            companyId,
            productionId: data.productionId,
            poids: data.poids,
            statutPaton: "EN_CHAMBRE_FROIDE",
        },
        take: data.nbPatons, // Si nbPatons défini, ne prend que N pâtons (les plus anciens)
        orderBy: { createdAt: "asc" },
    });
    if (patons.length === 0) {
        res.status(404).json({ success: false, message: "Aucun pâton à façonner dans ce lot" });
        return;
    }
    const maintenant = new Date();
    const totalPieces = patons.length * data.nbPiecesParPaton;
    const poidsTotal = Math.round((data.poids + data.poidsBeurre) * 100) / 100;
    const rendement = Math.round((data.nbPiecesParPaton / poidsTotal) * 100) / 100;
    const produit = await database_1.default.produit.findUnique({
        where: { id: data.produitId },
        select: { nom: true, dlvJours: true },
    });
    const dlvJours = produit?.dlvJours ?? 1;
    const dateExpiration = new Date(maintenant);
    dateExpiration.setHours(dateExpiration.getHours() + dlvJours * 24);
    await database_1.default.$transaction(async (tx) => {
        // Mettre à jour uniquement les N pâtons sélectionnés
        const patonIds = patons.map(p => p.id);
        // Déduire le beurre/MG du stock si spécifié
        if (data.beurreMP && data.poidsBeurre > 0) {
            const beurre = await tx.matierePremiere.findFirst({
                where: { id: data.beurreMP, companyId },
            });
            if (beurre && beurre.stockGere) {
                const qteTotal = data.poidsBeurre * patons.length;
                await tx.matierePremiere.update({
                    where: { id: data.beurreMP },
                    data: { stockActuel: { decrement: qteTotal } },
                });
                await tx.mouvementStock.create({
                    data: {
                        mpId: data.beurreMP,
                        type: "SORTIE_PRODUCTION",
                        quantite: qteTotal,
                        motif: `Façonnage ${patons.length} pâtons → ${totalPieces} pièces`,
                    },
                });
            }
        }
        await tx.paton.updateMany({
            where: { id: { in: patonIds } },
            data: {
                poidsBeurre: data.poidsBeurre,
                poidsTotal,
                nbPieces: data.nbPiecesParPaton,
                rendement,
                produitId: data.produitId,
                statutPaton: "FACONNE",
                dateFaconnage: maintenant,
            },
        });
        // Incrémenter le stock produit en une seule opération
        await tx.produit.update({
            where: { id: data.produitId },
            data: { stockActuel: { increment: totalPieces } },
        });
        // Créer un seul lot DLV pour tout le groupe
        await tx.lotStock.create({
            data: {
                companyId,
                produitId: data.produitId,
                quantiteInitiale: totalPieces,
                quantiteRestante: totalPieces,
                dateCreation: maintenant,
                dateExpiration,
                dlvJours,
                statut: "ACTIF",
                notesExpiration: `Lot façonné : ${patons.length} pâtons × ${data.nbPiecesParPaton} pcs = ${totalPieces} pcs`,
            },
        });
    });
    res.json({
        success: true,
        data: {
            nbPatons: patons.length,
            totalPieces,
            rendement,
            dlvJours,
            dateExpiration,
            message: `${patons.length} pâton(s) façonnés → ${totalPieces} "${produit?.nom}". Expire le ${dateExpiration.toLocaleDateString("fr-FR")}.`,
        },
    });
});
// POST /api/production/patons/perdre-lot — Déclarer tout un lot perdu
router.post("/patons/perdre-lot", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "CHEF_PATISSIER"]), async (req, res) => {
    const schema = zod_1.z.object({
        productionId: zod_1.z.string(),
        poids: zod_1.z.number().positive(),
        cause: zod_1.z.string().default("Pâton(s) perdu(s)"),
        nbPatons: zod_1.z.number().int().positive().optional(),
    });
    const data = schema.parse(req.body);
    const { companyId } = req.user;
    const patons = await database_1.default.paton.findMany({
        where: {
            companyId,
            productionId: data.productionId,
            poids: data.poids,
            statutPaton: "EN_CHAMBRE_FROIDE",
        },
        take: data.nbPatons, // Si nbPatons défini, ne prend que N pâtons
        orderBy: { createdAt: "asc" },
        include: { production: { include: { recette: { include: { ingredients: { include: { mp: true } } } } } } },
    });
    if (patons.length === 0) {
        res.status(404).json({ success: false, message: "Aucun pâton à déclarer perdu" });
        return;
    }
    const poidsTotalPerdu = Math.round(patons.reduce((s, p) => s + p.poids, 0) * 100) / 100;
    await database_1.default.$transaction(async (tx) => {
        // Marquer uniquement les N pâtons sélectionnés comme perdus
        const patonIds = patons.map(p => p.id);
        await tx.paton.updateMany({
            where: { id: { in: patonIds } },
            data: { statutPaton: "PERDU" },
        });
        // Créer une perte pour le lot entier
        await tx.perte.create({
            data: {
                companyId,
                type: "MATIERE_PREMIERE",
                quantite: poidsTotalPerdu,
                valeur: Math.round(poidsTotalPerdu * 2000), // Estimation coût pâte
                cause: `${data.cause} — ${patons.length} pâton(s) × ${data.poids}kg`,
                deductMP: false,
                date: new Date(),
            },
        });
    });
    res.json({
        success: true,
        data: {
            nbPatons: patons.length,
            poidsTotalPerdu,
            message: `${patons.length} pâton(s) (${poidsTotalPerdu} kg) déclarés perdus.`,
        },
    });
});
exports.default = router;
//# sourceMappingURL=production.routes.js.map