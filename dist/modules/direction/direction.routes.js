"use strict";
// src/modules/rapports/direction.routes.ts
// Route dédiée au tableau de bord Direction
// Montée séparément dans app.ts sur /api/direction
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const database_1 = __importDefault(require("../../config/database"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
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
// GET /api/direction
router.get("/", (0, auth_middleware_1.requireRole)(["ADMIN", "RESPONSABLE"]), async (req, res) => {
    const { companyId } = req.user;
    const periode = getPeriode(req);
    const precedente = getPeriodePrecedente(periode);
    const il_y_a_6_mois = new Date();
    il_y_a_6_mois.setMonth(il_y_a_6_mois.getMonth() - 6);
    il_y_a_6_mois.setDate(1);
    il_y_a_6_mois.setHours(0, 0, 0, 0);
    try {
        const [ventesAgg, ventesPrec, pertesAgg, pertesPrec, ventesDetail, lignesVente, productions, mouvementsMP, cmdsFourn, company, ventesParMois, pertesParMois, clientsCredit,] = await Promise.all([
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
                _sum: { valeur: true },
            }),
            database_1.default.vente.findMany({
                where: { companyId, date: periode },
                select: { montantTotal: true, modePaiement: true, date: true },
                take: 1000,
            }),
            database_1.default.ligneVente.findMany({
                where: { vente: { companyId, date: periode } },
                include: { produit: { select: { id: true, nom: true, prixVente: true } } },
                take: 2000,
            }),
            database_1.default.production.findMany({
                where: { companyId, date: periode },
                select: { quantiteFarine: true, pateTheorique: true, pateEffective: true },
                take: 500,
            }),
            database_1.default.mouvementStock.findMany({
                where: {
                    type: { in: ["SORTIE_PRODUCTION", "SORTIE_PERTE_MP"] },
                    mp: { companyId },
                    createdAt: { gte: periode.gte, lte: periode.lte },
                },
                include: { mp: { select: { prixAchat: true } } },
                take: 5000,
            }),
            database_1.default.commandeFournisseur.findMany({
                where: { companyId, statut: { in: ["BROUILLON", "ENVOYEE"] } },
                select: { montantTotal: true, statut: true },
            }),
            database_1.default.company.findUnique({
                where: { id: companyId },
                select: { chargesFixesMensuelles: true, objectifCA: true, seuilPertes: true, devise: true },
            }).catch(() => database_1.default.$queryRaw `
            SELECT COALESCE("chargesFixesMensuelles",0) as "chargesFixesMensuelles",
                   COALESCE("objectifCA",0) as "objectifCA",
                   COALESCE("seuilPertes",0) as "seuilPertes",
                   devise
            FROM "Company" WHERE id = ${companyId} LIMIT 1
          `.then(r => r[0] ?? null).catch(() => null)),
            database_1.default.vente.findMany({
                where: { companyId, date: { gte: il_y_a_6_mois } },
                select: { montantTotal: true, date: true },
                take: 5000,
            }),
            database_1.default.perte.findMany({
                where: { companyId, date: { gte: il_y_a_6_mois } },
                select: { valeur: true, date: true },
                take: 2000,
            }),
            database_1.default.client.findMany({
                where: { companyId },
                select: { id: true, nom: true, telephone: true, soldeCredit: true },
                take: 200,
            }).catch(() => []),
        ]);
        const caTotal = ventesAgg._sum.montantTotal ?? 0;
        const caPrecedent = ventesPrec._sum.montantTotal ?? 0;
        const nbTransactions = ventesAgg._count ?? 0;
        const panierMoyen = nbTransactions > 0 ? caTotal / nbTransactions : 0;
        const evolutionCA = caPrecedent > 0
            ? Math.round(((caTotal - caPrecedent) / caPrecedent) * 10000) / 100 : null;
        const objectifCA = company?.objectifCA ?? 0;
        const tauxRealisationCA = objectifCA > 0
            ? Math.round((caTotal / objectifCA) * 10000) / 100 : null;
        const coutMPReel = mouvementsMP.reduce((s, m) => s + Math.abs(m.quantite) * (m.mp?.prixAchat ?? 0), 0);
        const margeValeur = caTotal - coutMPReel;
        const margePct = caTotal > 0
            ? Math.round((margeValeur / caTotal) * 10000) / 100 : 0;
        const chargesMensuelles = company?.chargesFixesMensuelles ?? 0;
        const nbJoursPeriode = Math.max(1, Math.round((periode.lte.getTime() - periode.gte.getTime()) / (1000 * 60 * 60 * 24)));
        const chargesPeriode = Math.round(chargesMensuelles * nbJoursPeriode / 30);
        const pertesTotal = pertesAgg._sum.valeur ?? 0;
        const pertesPrecedent = pertesPrec._sum.valeur ?? 0;
        const pertesEvolution = pertesPrecedent > 0
            ? Math.round(((pertesTotal - pertesPrecedent) / pertesPrecedent) * 10000) / 100 : null;
        const pertesRatio = caTotal > 0
            ? Math.round((pertesTotal / caTotal) * 10000) / 100 : 0;
        const resultatNet = Math.round(margeValeur - pertesTotal - chargesPeriode);
        const tauxResultat = caTotal > 0
            ? Math.round((resultatNet / caTotal) * 10000) / 100 : 0;
        const parMode = {};
        for (const v of ventesDetail) {
            parMode[v.modePaiement] = (parMode[v.modePaiement] ?? 0) + v.montantTotal;
        }
        const totalCredit = parMode["A_CREDIT"] ?? 0;
        const totalEspeces = parMode["ESPECES"] ?? 0;
        const totalMobile = parMode["MOBILE_MONEY"] ?? 0;
        const parProduit = new Map();
        for (const l of lignesVente) {
            if (!l.produit)
                continue;
            const ex = parProduit.get(l.produitId) ?? { nom: l.produit.nom, qte: 0, ca: 0 };
            ex.qte += l.quantite;
            ex.ca += l.sousTotal;
            parProduit.set(l.produitId, ex);
        }
        const topProduits = Array.from(parProduit.entries())
            .map(([id, d]) => ({ id, ...d, ca: Math.round(d.ca) }))
            .sort((a, b) => b.ca - a.ca)
            .slice(0, 10);
        const caParMois = {};
        const pertesParMoisMap = {};
        for (const v of ventesParMois) {
            const key = new Date(v.date).toISOString().slice(0, 7);
            caParMois[key] = (caParMois[key] ?? 0) + v.montantTotal;
        }
        for (const p of pertesParMois) {
            const key = new Date(p.date).toISOString().slice(0, 7);
            pertesParMoisMap[key] = (pertesParMoisMap[key] ?? 0) + (p.valeur ?? 0);
        }
        const evolutionMensuelle = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() - i);
            const key = d.toISOString().slice(0, 7);
            const ca = Math.round(caParMois[key] ?? 0);
            const pertes = Math.round(pertesParMoisMap[key] ?? 0);
            evolutionMensuelle.push({
                mois: key,
                label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
                ca, pertes, resultat: ca - pertes,
            });
        }
        const totalFarine = Math.round(productions.reduce((s, p) => s + p.quantiteFarine, 0) * 100) / 100;
        const ecartQualite = productions.length > 0
            ? Math.round(productions.reduce((s, p) => {
                const theo = p.pateTheorique;
                return s + (theo > 0 ? Math.abs((p.pateEffective ?? theo) - theo) / theo * 100 : 0);
            }, 0) / productions.length * 100) / 100
            : 0;
        const montantEngage = Math.round(cmdsFourn.reduce((s, c) => s + (c.montantTotal ?? 0), 0));
        const nbCmdsEnvoyees = cmdsFourn.filter(c => c.statut === "ENVOYEE").length;
        const creancesClients = clientsCredit
            .filter((c) => (c.soldeCredit ?? 0) > 0)
            .map((c) => ({ id: c.id, nom: c.nom, telephone: c.telephone, solde: Math.round(c.soldeCredit) }))
            .sort((a, b) => b.solde - a.solde)
            .slice(0, 20);
        const totalCreances = creancesClients.reduce((s, c) => s + c.solde, 0);
        const scorePertes = pertesRatio <= 3 ? "BON" : pertesRatio <= 8 ? "MOYEN" : "MAUVAIS";
        const scoreMarge = margePct >= 60 ? "BON" : margePct >= 40 ? "MOYEN" : "MAUVAIS";
        const scoreResult = tauxResultat >= 15 ? "BON" : tauxResultat >= 5 ? "MOYEN" : tauxResultat >= 0 ? "LIMITE" : "MAUVAIS";
        res.json({
            success: true,
            data: {
                kpis: {
                    caTotal: Math.round(caTotal), caPrecedent: Math.round(caPrecedent), evolutionCA,
                    objectifCA, tauxRealisationCA, nbTransactions,
                    panierMoyen: Math.round(panierMoyen),
                    coutMPReel: Math.round(coutMPReel),
                    margeValeur: Math.round(margeValeur), margePct,
                    chargesPeriode, chargesMensuelles: Math.round(chargesMensuelles), nbJoursPeriode,
                    pertesTotal: Math.round(pertesTotal), pertesPrecedent: Math.round(pertesPrecedent),
                    pertesEvolution, pertesRatio,
                    resultatNet, tauxResultat,
                    totalCredit: Math.round(totalCredit),
                    totalEspeces: Math.round(totalEspeces),
                    totalMobile: Math.round(totalMobile),
                    totalCreances,
                },
                sante: {
                    scoreMarge, scorePertes, scoreResult,
                    pertesDepasseSeuil: company?.seuilPertes > 0 && pertesTotal > (company?.seuilPertes ?? 0),
                    objectifAtteint: objectifCA > 0 && caTotal >= objectifCA,
                },
                parMode,
                topProduits,
                evolutionMensuelle,
                production: { nbSessions: productions.length, totalFarine, ecartQualitePct: ecartQualite },
                achats: { montantEngage, nbCmdsEnvoyees },
                creancesClients,
                totalCreances: Math.round(totalCreances),
                periode: {
                    debut: periode.gte.toISOString().split("T")[0],
                    fin: periode.lte.toISOString().split("T")[0],
                    nbJours: nbJoursPeriode,
                },
            },
        });
    }
    catch (err) {
        console.error("[direction] Erreur:", err?.message ?? err);
        res.status(500).json({
            success: false,
            message: "Erreur tableau de bord direction.",
            detail: err?.message,
        });
    }
});
exports.default = router;
//# sourceMappingURL=direction.routes.js.map