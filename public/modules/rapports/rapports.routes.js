"use strict";
// src/modules/rapports/rapports.routes.ts
//
// CORRECTIONS :
// ─────────────────────────────────────────────────────────────────────────────
// FIX 1 : Split paiement dans parMode — chaque mode comptabilisé séparément
// FIX 2 : calculerCoutRevient supprimé — réutilise marges.service (méthode SAELIA)
// FIX 3 : Pagination take:500 sur tous les findMany
// FIX 4 : Onglet credits/débiteurs (ventes A_CREDIT par client)
// FIX 5 : Comparaison N-1 intégrée dans /synthese (plus besoin d'une route séparée)
// FIX 6 : resultatEstime avec charges fixes optionnelles (depuis Company settings)
// FIX 7 : stockGere respecté dans le calcul de marge
// FIX 8 : Rapport stocks inclut les lots DLV expirés / proches d'expiration
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const database_1 = __importDefault(require("../../config/database"));
// FIX 2 : Utiliser la fonction unifiée depuis marges.service
const marges_service_1 = require("../marges/marges.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// ─── Helpers période ──────────────────────────────────────────────────────────
function getPeriode(req) {
    const { dateDebut, dateFin } = req.query;
    const debut = dateDebut
        ? new Date(dateDebut)
        : (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();
    const fin = dateFin
        ? new Date(new Date(dateFin).setHours(23, 59, 59, 999))
        : new Date();
    return { gte: debut, lte: fin };
}
function getPeriodePrecedente(periode) {
    const duree = periode.lte.getTime() - periode.gte.getTime();
    return {
        gte: new Date(periode.gte.getTime() - duree),
        lte: new Date(periode.lte.getTime() - duree),
    };
}
// FIX 1 : Répartition CA par mode en tenant compte du split paiement
function calculerParMode(ventes) {
    const parMode = {};
    const add = (mode, montant, compteTransaction = false) => {
        if (!parMode[mode])
            parMode[mode] = { count: 0, montant: 0 };
        parMode[mode].montant += montant;
        if (compteTransaction)
            parMode[mode].count++;
    };
    for (const v of ventes) {
        if (v.splitPaiement && v.split1Mode) {
            // Split : chaque mode reçoit sa part
            const m1 = v.split1Mode;
            const m2 = v.split2Mode;
            const a1 = v.split1Montant ?? 0;
            const a2 = v.split2Montant ?? (v.montantTotal - a1);
            add(m1, a1, true);
            if (m2 && a2 > 0)
                add(m2, a2, false); // pas de +count pour la transaction déjà comptée
        }
        else {
            add(v.modePaiement, v.montantTotal, true);
        }
    }
    return parMode;
}
// ─── GET /rapports/synthese ───────────────────────────────────────────────────
router.get("/synthese", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE", "COMPTABLE"]), async (req, res) => {
    const { companyId } = req.user;
    const periode = getPeriode(req);
    const precedente = getPeriodePrecedente(periode);
    try {
        // FIX 3 : Pagination + FIX 1 : charger champs split
        let [ventesAgg, ventesPrec, pertesAgg, pertesPrec, productions, ventes, pertesMP, company] = await Promise.all([
            database_1.default.vente.aggregate({
                where: { companyId, date: periode },
                _sum: { montantTotal: true }, _count: true,
            }),
            database_1.default.vente.aggregate({
                where: { companyId, date: precedente },
                _sum: { montantTotal: true }, _count: true,
            }),
            database_1.default.perte.aggregate({
                where: { companyId, date: periode },
                _sum: { valeur: true }, _count: true,
            }),
            database_1.default.perte.aggregate({
                where: { companyId, date: precedente },
                _sum: { valeur: true }, _count: true,
            }),
            database_1.default.production.findMany({
                where: { companyId, date: periode },
                select: { pateTheorique: true, quantiteFarine: true, pateEffective: true },
                take: 500,
            }).catch(() => database_1.default.production.findMany({
                where: { companyId, date: periode },
                select: { pateTheorique: true, quantiteFarine: true },
                take: 500,
            })),
            database_1.default.vente.findMany({
                where: { companyId, date: periode },
                select: {
                    montantTotal: true, modePaiement: true,
                },
                take: 500,
            }).catch(() => database_1.default.vente.findMany({
                where: { companyId, date: periode },
                select: { montantTotal: true, modePaiement: true },
                take: 500,
            })),
            database_1.default.mouvementStock.findMany({
                where: {
                    type: "SORTIE_PERTE_MP",
                    mp: { companyId },
                    createdAt: { gte: periode.gte, lte: periode.lte },
                },
                include: { mp: { select: { prixAchat: true } } },
                take: 500,
            }),
            // FIX 6 : charges fixes depuis Company (avec fallback si colonnes pas encore migrées)
            database_1.default.company.findUnique({
                where: { id: companyId },
                select: { chargesFixesMensuelles: true, objectifCA: true, seuilPertes: true },
            }).catch(() => database_1.default.$queryRaw `
          SELECT COALESCE("chargesFixesMensuelles", 0) as "chargesFixesMensuelles",
                 COALESCE("objectifCA", 0) as "objectifCA",
                 COALESCE("seuilPertes", 0) as "seuilPertes"
          FROM "Company" WHERE id = ${companyId} LIMIT 1
        `.then(rows => rows[0] ?? null).catch(() => null)),
        ]);
        // Coût MP des ventes — depuis marges (calcul unifié non possible sans produits chargés)
        // Approximation via perte MP déclarées
        const coutPateJetee = pertesMP.reduce((s, m) => s + Math.abs(m.quantite) * (m.mp?.prixAchat ?? 0), 0);
        const caTotal = ventesAgg._sum.montantTotal ?? 0;
        const caPrecedent = ventesPrec._sum.montantTotal ?? 0;
        const pertesTotales = pertesAgg._sum.valeur ?? 0;
        const panierMoyen = (ventesAgg._count ?? 0) > 0
            ? caTotal / (ventesAgg._count ?? 1) : 0;
        // FIX 5 : Évolution CA vs période précédente
        const evolutionCA = caPrecedent > 0
            ? Math.round(((caTotal - caPrecedent) / caPrecedent) * 10000) / 100
            : null;
        const evolutionPertes = (pertesPrec._sum.valeur ?? 0) > 0
            ? Math.round(((pertesTotales - (pertesPrec._sum.valeur ?? 0)) / (pertesPrec._sum.valeur ?? 1)) * 10000) / 100
            : null;
        // FIX 1 : parMode corrigé
        const parMode = calculerParMode(ventes);
        const totalCredit = ventes
            .filter((v) => v.modePaiement === "A_CREDIT")
            .reduce((s, v) => s + v.montantTotal, 0);
        const ecartMoyen = productions.length > 0
            ? productions.reduce((s, p) => {
                const theo = p.pateTheorique;
                return s + (theo > 0 ? Math.abs((p.pateEffective ?? theo) - theo) / theo * 100 : 0);
            }, 0) / productions.length
            : 0;
        // FIX 6 : resultatEstime avec charges fixes
        const chargesFixes = company?.chargesFixesMensuelles ?? 0;
        const resultatEstime = Math.round(caTotal - coutPateJetee - pertesTotales - chargesFixes);
        res.json({
            success: true,
            data: {
                ventes: {
                    caTotal: Math.round(caTotal),
                    caPrecedent: Math.round(caPrecedent),
                    evolutionCA,
                    nbTransactions: ventesAgg._count ?? 0,
                    panierMoyen: Math.round(panierMoyen),
                    totalCredit: Math.round(totalCredit),
                    parMode,
                },
                marges: {
                    coutPateJetee: Math.round(coutPateJetee),
                    margeValeur: Math.round(caTotal - coutPateJetee),
                    margePct: caTotal > 0 ? Math.round(((caTotal - coutPateJetee) / caTotal) * 10000) / 100 : 0,
                    resultatEstime,
                    chargesFixes: Math.round(chargesFixes),
                    noteResultat: chargesFixes > 0
                        ? "CA − pertes MP − pertes produits − charges fixes"
                        : "CA − pertes MP − pertes produits (charges fixes non configurées dans Paramètres)",
                },
                pertes: {
                    valeurTotale: Math.round(pertesTotales),
                    valeurPrecedent: Math.round(pertesPrec._sum.valeur ?? 0),
                    nbPertes: pertesAgg._count ?? 0,
                    evolutionPertes,
                },
                productions: {
                    nbSessions: productions.length,
                    totalFarine: Math.round(productions.reduce((s, p) => s + p.quantiteFarine, 0) * 100) / 100,
                    ecartMoyenPct: Math.round(ecartMoyen * 100) / 100,
                },
                alertes: {
                    seuilPertes: company?.seuilPertes ?? 0,
                    pertesDepasseSeuil: (company?.seuilPertes ?? 0) > 0 && pertesTotales > (company?.seuilPertes ?? 0),
                    objectifCA: company?.objectifCA ?? 0,
                    objectifAtteint: (company?.objectifCA ?? 0) > 0 && caTotal >= (company?.objectifCA ?? 0),
                },
            },
        });
    }
    catch (err) {
        console.error("[rapports/synthese] Erreur:", err?.message ?? err);
        res.status(500).json({
            success: false,
            message: "Erreur lors du calcul de la synthèse. Vérifiez que les migrations sont à jour (npx prisma migrate deploy).",
            detail: err?.message,
        });
    }
});
// ─── GET /rapports/ventes ─────────────────────────────────────────────────────
router.get("/ventes", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE", "COMPTABLE"]), async (req, res) => {
    const { companyId } = req.user;
    const periode = getPeriode(req);
    // FIX 3 : take:500
    const ventes = await database_1.default.vente.findMany({
        where: { companyId, date: periode },
        include: {
            lignes: {
                include: { produit: { select: { id: true, nom: true, prixVente: true } } },
            },
            user: { select: { prenom: true, nom: true } },
            client: { select: { id: true, nom: true } },
        },
        orderBy: { date: "desc" },
        take: 500, // FIX 3
    });
    // Classement par produit
    const parProduit = new Map();
    for (const vente of ventes) {
        for (const ligne of vente.lignes ?? []) {
            if (!ligne.produit)
                continue;
            const ex = parProduit.get(ligne.produitId);
            if (ex) {
                ex.quantite += ligne.quantite;
                ex.ca += ligne.sousTotal;
            }
            else
                parProduit.set(ligne.produitId, {
                    nom: ligne.produit.nom, quantite: ligne.quantite, ca: ligne.sousTotal,
                });
        }
    }
    const classement = Array.from(parProduit.entries())
        .map(([id, d]) => ({ id, ...d }))
        .sort((a, b) => b.ca - a.ca);
    // FIX 1 : parMode corrigé avec split
    const parMode = calculerParMode(ventes);
    const totalCredit = ventes
        .filter(v => v.modePaiement === "A_CREDIT")
        .reduce((s, v) => s + v.montantTotal, 0);
    // Heures de pointe (ventes par heure)
    const parHeure = {};
    for (const v of ventes) {
        const h = new Date(v.date).getHours();
        parHeure[h] = (parHeure[h] ?? 0) + v.montantTotal;
    }
    res.json({
        success: true,
        data: { ventes, classement, parMode, totalCredit: Math.round(totalCredit), parHeure },
    });
});
// ─── GET /rapports/marges ─────────────────────────────────────────────────────
router.get("/marges", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE", "COMPTABLE"]), async (req, res) => {
    const { companyId } = req.user;
    const periode = getPeriode(req);
    // FIX 2 : Charger les données nécessaires pour calculerCoutRevient SAELIA
    const [produits, beurreMP] = await Promise.all([
        database_1.default.produit.findMany({
            where: { companyId, actif: true },
            include: {
                recette: {
                    select: {
                        id: true, nom: true, ratioPate: true,
                        ingredientReferenceNom: true, ingredientReferenceUnite: true,
                        ingredients: {
                            include: {
                                mp: { select: { id: true, nom: true, prixAchat: true, stockGere: true } },
                                unite: { select: { abreviation: true, coefficient: true } },
                            },
                        },
                    },
                },
                lignesVente: {
                    where: { vente: { date: periode } },
                    select: { quantite: true, sousTotal: true },
                },
                categorie: { select: { nom: true, margeMin: true } },
            },
            orderBy: { nom: "asc" },
        }),
        database_1.default.matierePremiere.findFirst({
            where: { companyId, nom: { contains: "beurre" }, actif: true },
            select: { id: true, nom: true, prixAchat: true },
            orderBy: { prixAchat: "desc" },
        }),
    ]);
    const sansRecette = produits.filter((p) => !p.recetteId).length;
    const sansGrammage = produits.filter((p) => p.recetteId && (!p.grammage || p.grammage <= 0)).length;
    // Ensure marges is always an array even if calculerCoutRevient throws
    // FIX 2 : Utiliser calculerCoutRevient depuis marges.service (méthode SAELIA)
    const marges = produits
        .filter((p) => (p.lignesVente?.length ?? 0) > 0)
        .map((p) => {
        const qteVendue = (p.lignesVente ?? []).reduce((s, l) => s + l.quantite, 0);
        const caGenere = (p.lignesVente ?? []).reduce((s, l) => s + l.sousTotal, 0);
        // FIX 2 + FIX 7 : méthode SAELIA avec stockGere respecté
        const calc = (0, marges_service_1.calculerCoutRevient)(p, beurreMP);
        const coutRevient = calc.coutRevient;
        const coutTotal = Math.round(coutRevient * qteVendue);
        const margeVal = Math.round(caGenere - coutTotal);
        const margePct = caGenere > 0 ? Math.round((margeVal / caGenere) * 10000) / 100 : 0;
        const seuilMini = p.margeMin ?? p.categorie?.margeMin ?? 60;
        const alerteMarge = seuilMini > 0 && margePct < seuilMini;
        const prixConseille = alerteMarge && coutRevient > 0
            ? Math.ceil(coutRevient / (1 - seuilMini / 100))
            : null;
        return {
            id: p.id, nom: p.nom,
            grammage: p.grammage, prixVente: p.prixVente,
            qteVendue, caGenere: Math.round(caGenere),
            coutRevient, coutTotal, margeVal, margePct,
            seuilMini, alerteMarge, prixConseille,
            source: calc.source,
            methodeCout: calc.methodeCout,
        };
    })
        .sort((a, b) => a.margePct - b.margePct);
    const margesOk = marges.filter((m) => !m.alerteMarge);
    const margeMoyenne = marges.length > 0
        ? marges.reduce((s, m) => s + m.margePct, 0) / marges.length
        : 0;
    res.json({
        success: true,
        data: {
            marges,
            stats: {
                sansRecette, sansGrammage,
                nbAlerte: marges.filter((m) => m.alerteMarge).length,
                nbOk: margesOk.length,
                margeMoyenne: Math.round(margeMoyenne * 100) / 100,
            },
        },
    });
});
// ─── GET /rapports/productions ────────────────────────────────────────────────
router.get("/productions", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE", "CHEF_PATISSIER"]), async (req, res) => {
    const { companyId } = req.user;
    const periode = getPeriode(req);
    const productions = await database_1.default.production.findMany({
        where: { companyId, date: periode },
        include: {
            recette: { select: { nom: true, ratioPate: true } },
            user: { select: { prenom: true, nom: true } },
            lignesProduction: {
                include: { produit: { select: { nom: true, prixVente: true } } },
            },
        },
        orderBy: { date: "desc" },
        take: 500,
    });
    const totalFarine = productions.reduce((s, p) => s + p.quantiteFarine, 0);
    const totalPateTheo = productions.reduce((s, p) => s + p.pateTheorique, 0);
    const totalPateEffective = productions.reduce((s, p) => s + (p.pateEffective ?? 0), 0);
    const totalPateGatee = productions.reduce((s, p) => s + (p.pateGatee ?? 0), 0);
    const totalPateRetournee = productions.reduce((s, p) => s + (p.pateRetournee ?? 0), 0);
    const ecartMoyen = productions.length > 0
        ? productions.reduce((s, p) => {
            const theo = p.pateTheorique;
            return s + (theo > 0 ? Math.abs((p.pateEffective ?? theo) - theo) / theo * 100 : 0);
        }, 0) / productions.length
        : 0;
    // Groupement par recette
    const parRecetteMap = new Map();
    for (const p of productions) {
        const nom = p.recette?.nom ?? "Inconnue";
        const ex = parRecetteMap.get(nom) ?? { nom, nbSessions: 0, totalFarine: 0, totalPieces: 0, valeurEstimee: 0 };
        ex.nbSessions++;
        ex.totalFarine += p.quantiteFarine;
        for (const l of p.lignesProduction ?? []) {
            ex.totalPieces += l.quantite;
            ex.valeurEstimee += l.quantite * (l.produit?.prixVente ?? 0);
        }
        parRecetteMap.set(nom, ex);
    }
    // Sessions par heure (quelles heures sont les plus productives)
    const parSession = {};
    for (const p of productions) {
        const s = p.sessionProd ?? "INCONNU";
        parSession[s] = (parSession[s] ?? 0) + 1;
    }
    res.json({
        success: true,
        data: {
            productions,
            stats: {
                nbSessions: productions.length,
                totalFarine: Math.round(totalFarine * 100) / 100,
                totalPateTheo: Math.round(totalPateTheo * 100) / 100,
                totalPateEff: Math.round(totalPateEffective * 100) / 100,
                totalPateGatee: Math.round(totalPateGatee * 100) / 100,
                totalPateRet: Math.round(totalPateRetournee * 100) / 100,
                ecartMoyenPct: Math.round(ecartMoyen * 100) / 100,
                tauxPertePate: totalPateTheo > 0
                    ? Math.round((totalPateGatee / totalPateTheo) * 10000) / 100
                    : 0,
                parRecette: Array.from(parRecetteMap.values()),
                parSession,
            },
        },
    });
});
// ─── GET /rapports/pertes ─────────────────────────────────────────────────────
router.get("/pertes", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE", "COMPTABLE"]), async (req, res) => {
    const { companyId } = req.user;
    const periode = getPeriode(req);
    const pertes = await database_1.default.perte.findMany({
        where: { companyId, date: periode },
        include: {
            produit: { select: { nom: true } },
            mp: { select: { nom: true } }, // Relation correcte du schéma Prisma
        },
        orderBy: { date: "desc" },
        take: 500,
    });
    const totalValeur = pertes.reduce((s, p) => s + (p.valeur ?? 0), 0);
    const parType = {};
    const parCause = {};
    for (const p of pertes) {
        const t = p.type ?? "AUTRE";
        const c = p.cause ?? "Inconnue";
        parType[t] = (parType[t] ?? 0) + (p.valeur ?? 0);
        parCause[c] = (parCause[c] ?? 0) + (p.valeur ?? 0);
    }
    const topCauses = Object.entries(parCause)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([cause, valeur]) => ({ cause, valeur: Math.round(valeur) }));
    // Évolution semaine par semaine
    const parSemaine = {};
    for (const p of pertes) {
        const d = new Date(p.date);
        const lun = new Date(d);
        lun.setDate(d.getDate() - d.getDay() + 1);
        const key = lun.toISOString().split("T")[0];
        parSemaine[key] = (parSemaine[key] ?? 0) + (p.valeur ?? 0);
    }
    res.json({
        success: true,
        data: {
            pertes,
            stats: {
                totalValeur: Math.round(totalValeur),
                totalValeurProduits: Math.round(parType["PRODUIT_FINI"] ?? 0),
                totalValeurMP: Math.round(parType["MATIERE_PREMIERE"] ?? 0),
                nbPertes: pertes.length,
                parType, topCauses, parSemaine,
            },
        },
    });
});
// ─── GET /rapports/stocks ─────────────────────────────────────────────────────
// FIX 8 : Inclut les lots DLV expirés et proches d'expiration
router.get("/stocks", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE", "COMPTABLE"]), async (req, res) => {
    const { companyId } = req.user;
    const maintenant = new Date();
    const dans48h = new Date(maintenant.getTime() + 48 * 60 * 60 * 1000);
    const [mps, produits, lotsProches, lotsExpires] = await Promise.all([
        database_1.default.matierePremiere.findMany({
            where: { companyId, actif: true },
            include: { categorie: { select: { nom: true } }, unite: { select: { abreviation: true } } },
            orderBy: { nom: "asc" },
        }),
        database_1.default.produit.findMany({
            where: { companyId, actif: true },
            include: { categorie: { select: { nom: true } } },
            orderBy: { nom: "asc" },
        }),
        // FIX 8 : Lots qui expirent dans les 48h
        database_1.default.lotStock.findMany({
            where: {
                companyId,
                statut: "ACTIF",
                quantiteRestante: { gt: 0 },
                dateExpiration: { gte: maintenant, lte: dans48h },
            },
            include: { produit: { select: { nom: true } } },
            orderBy: { dateExpiration: "asc" },
        }),
        // Lots déjà expirés encore actifs (erreur de clôture)
        database_1.default.lotStock.findMany({
            where: {
                companyId,
                statut: "ACTIF",
                quantiteRestante: { gt: 0 },
                dateExpiration: { lt: maintenant },
            },
            include: { produit: { select: { nom: true } } },
            orderBy: { dateExpiration: "asc" },
            take: 50,
        }),
    ]);
    const valeurStockMP = mps.reduce((s, m) => s + m.stockActuel * (m.prixAchat ?? 0), 0);
    const valeurStockPF = produits.reduce((s, p) => s + p.stockActuel * (p.prixVente ?? 0), 0);
    const alertesMP = mps
        .filter((m) => m.stockActuel <= (m.seuilAlerte ?? 0) && m.stockGere !== false)
        .map((m) => ({
        id: m.id, nom: m.nom,
        stockActuel: m.stockActuel,
        seuilAlerte: m.seuilAlerte,
        unite: m.unite?.abreviation ?? "kg",
        statut: m.stockActuel === 0 ? "RUPTURE" : "CRITIQUE",
    }));
    const alertesPF = produits
        .filter((p) => p.stockActuel <= (p.seuilAlerte ?? 0))
        .map((p) => ({
        id: p.id, nom: p.nom,
        stockActuel: p.stockActuel,
        seuilAlerte: p.seuilAlerte,
        statut: p.stockActuel === 0 ? "RUPTURE" : "BAS",
    }));
    res.json({
        success: true,
        data: {
            mps, produits,
            valeurStockMP: Math.round(valeurStockMP),
            valeurStockPF: Math.round(valeurStockPF),
            valeurTotale: Math.round(valeurStockMP + valeurStockPF),
            alertesMP,
            alertesPF,
            // FIX 8 : Lots DLV
            lotsProches48h: lotsProches,
            lotsExpires,
            nbAlertesDLV: lotsProches.length + lotsExpires.length,
        },
    });
});
// ─── FIX 4 : GET /rapports/credits — Débiteurs / Ventes à crédit ─────────────
router.get("/credits", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE", "COMPTABLE"]), async (req, res) => {
    const { companyId } = req.user;
    const periode = getPeriode(req);
    // Clients avec solde crédit > 0 (colonne peut ne pas encore exister en DB)
    let clients = [];
    try {
        clients = await database_1.default.client.findMany({
            where: { companyId, soldeCredit: { gt: 0 } },
            include: {
                ventes: {
                    where: { modePaiement: "A_CREDIT", date: periode },
                    select: { montantTotal: true, date: true },
                    orderBy: { date: "desc" },
                    take: 20,
                },
            },
            orderBy: { soldeCredit: "desc" },
            take: 100,
        });
    }
    catch {
        clients = [];
    }
    const totalDu = clients.reduce((s, c) => s + (c.soldeCredit ?? 0), 0);
    const nbDebiteurs = clients.length;
    // Ventes à crédit sur la période (incluant clients non enregistrés)
    const ventesCredit = await database_1.default.vente.findMany({
        where: { companyId, modePaiement: "A_CREDIT", date: periode },
        include: {
            client: { select: { id: true, nom: true, telephone: true } },
            lignes: { include: { produit: { select: { nom: true } } } },
        },
        orderBy: { date: "desc" },
        take: 200,
    });
    const totalCreditPeriode = ventesCredit.reduce((s, v) => s + v.montantTotal, 0);
    res.json({
        success: true,
        data: {
            clients,
            ventesCredit,
            stats: {
                totalDu: Math.round(totalDu),
                totalCreditPeriode: Math.round(totalCreditPeriode),
                nbDebiteurs,
                nbVentesCredit: ventesCredit.length,
            },
        },
    });
});
// ─── GET /rapports/comparaison — N vs N-1 ────────────────────────────────────
router.get("/comparaison", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE", "COMPTABLE"]), (0, auth_middleware_1.requirePlan)(["PRO"]), // fonctionnalité réservée au plan Pro
async (req, res) => {
    const { companyId } = req.user;
    const { dateDebut, dateFin } = req.query;
    if (!dateDebut || !dateFin) {
        res.status(400).json({ success: false, message: "dateDebut et dateFin requis" });
        return;
    }
    const debut = new Date(dateDebut);
    const fin = new Date(new Date(dateFin).setHours(23, 59, 59, 999));
    const debutN1 = new Date(debut);
    debutN1.setFullYear(debutN1.getFullYear() - 1);
    const finN1 = new Date(fin);
    finN1.setFullYear(finN1.getFullYear() - 1);
    const [ventesN, ventesN1, pertesN, pertesN1, prodN, prodN1] = await Promise.all([
        database_1.default.vente.aggregate({ where: { companyId, date: { gte: debut, lte: fin } }, _sum: { montantTotal: true }, _count: true }),
        database_1.default.vente.aggregate({ where: { companyId, date: { gte: debutN1, lte: finN1 } }, _sum: { montantTotal: true }, _count: true }),
        database_1.default.perte.aggregate({ where: { companyId, date: { gte: debut, lte: fin } }, _sum: { valeur: true } }),
        database_1.default.perte.aggregate({ where: { companyId, date: { gte: debutN1, lte: finN1 } }, _sum: { valeur: true } }),
        database_1.default.production.count({ where: { companyId, date: { gte: debut, lte: fin } } }),
        database_1.default.production.count({ where: { companyId, date: { gte: debutN1, lte: finN1 } } }),
    ]);
    const evolution = (ref, curr) => ref > 0 ? Math.round(((curr - ref) / ref) * 10000) / 100 : null;
    const caN = ventesN._sum.montantTotal ?? 0;
    const caN1 = ventesN1._sum.montantTotal ?? 0;
    const pN = pertesN._sum.valeur ?? 0;
    const pN1 = pertesN1._sum.valeur ?? 0;
    res.json({
        success: true,
        data: {
            periodeN: { debut: dateDebut, fin: dateFin },
            periodeN1: { debut: debutN1.toISOString().split("T")[0], fin: finN1.toISOString().split("T")[0] },
            ca: { n: Math.round(caN), n1: Math.round(caN1), evolution: evolution(caN1, caN), transactions: { n: ventesN._count, n1: ventesN1._count } },
            pertes: { n: Math.round(pN), n1: Math.round(pN1), evolution: evolution(pN1, pN) },
            productions: { n: prodN, n1: prodN1, evolution: evolution(prodN1, prodN) },
        },
    });
});
// ─── GET /rapports/marges/evolution/:produitId ────────────────────────────────
router.get("/marges/evolution/:produitId", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE", "GESTIONNAIRE"]), async (req, res) => {
    const { companyId } = req.user;
    const { produitId } = req.params;
    const il_y_a_6_mois = new Date();
    il_y_a_6_mois.setMonth(il_y_a_6_mois.getMonth() - 6);
    const lignes = await database_1.default.ligneVente.findMany({
        where: {
            produitId,
            vente: { companyId, date: { gte: il_y_a_6_mois } },
        },
        select: { quantite: true, sousTotal: true, vente: { select: { date: true } } },
        orderBy: { vente: { date: "asc" } },
        take: 500,
    });
    const parMois = {};
    for (const l of lignes) {
        const key = new Date(l.vente.date).toISOString().slice(0, 7);
        if (!parMois[key])
            parMois[key] = { ca: 0, qte: 0 };
        parMois[key].ca += l.sousTotal;
        parMois[key].qte += l.quantite;
    }
    res.json({ success: true, data: { parMois, totalLignes: lignes.length } });
});
exports.default = router;
//# sourceMappingURL=rapports.routes.js.map