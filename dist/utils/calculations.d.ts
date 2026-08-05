export declare function calculerCoutRecette(recetteId: string): Promise<number>;
export declare function calculerMargeProduit(produitId: string): Promise<{
    coutMP: number;
    coutParKgPate: number;
    coutRevient: number;
    piecesParKgFarine: number;
    margeValeur: number;
    margePct: number;
}>;
export declare function calculerNombrePieces(pateReelleKg: number, grammageGrammes: number): number;
export declare function calculerPateTheorique(quantiteFarine: number, ratioPate: number): number;
export declare function calculerEcartProduction(pateTheorique: number, pateReelle: number): {
    ecartKg: number;
    ecartPct: number;
};
export declare function deduireStockMP(mpId: string, quantite: number, typeMouvement: "SORTIE_PRODUCTION" | "SORTIE_PERTE_MP" | "SORTIE_PERTE_PRODUIT", motif?: string): Promise<void>;
export declare function calculerImpactMPProduitPerdu(produitId: string, quantite: number): Promise<{
    mpId: string;
    mpNom: string;
    quantiteADeduire: number;
}[]>;
//# sourceMappingURL=calculations.d.ts.map