import { z } from "zod";
export declare const enregistrerProductionSchema: z.ZodObject<{
    recetteId: z.ZodString;
    numeroPetrin: z.ZodDefault<z.ZodNumber>;
    sessionProd: z.ZodDefault<z.ZodEnum<["NUIT", "JOUR"]>>;
    nomPetrisseur: z.ZodOptional<z.ZodString>;
    heureDebut: z.ZodOptional<z.ZodString>;
    heureFin: z.ZodOptional<z.ZodString>;
    categorieProd: z.ZodDefault<z.ZodEnum<["BOULANGERIE", "VIENNOISERIE_PETRISSAGE", "PATISSERIE"]>>;
    typeProduction: z.ZodDefault<z.ZodEnum<["VENTE", "COMMANDE"]>>;
    nomClient: z.ZodOptional<z.ZodString>;
    quantiteFarine: z.ZodNumber;
    pateRecuperee: z.ZodDefault<z.ZodNumber>;
    pateEffective: z.ZodNumber;
    pateRetournee: z.ZodDefault<z.ZodNumber>;
    pateGatee: z.ZodDefault<z.ZodNumber>;
    causeGatee: z.ZodOptional<z.ZodString>;
    estDernierPetrin: z.ZodDefault<z.ZodBoolean>;
    pateGardee: z.ZodDefault<z.ZodNumber>;
    destinationPateGardee: z.ZodOptional<z.ZodEnum<["recuperee_demain", "gatee"]>>;
    lignes: z.ZodDefault<z.ZodArray<z.ZodObject<{
        produitId: z.ZodString;
        quantite: z.ZodNumber;
        poidsUnitaire: z.ZodNumber;
        mettreEnStock: z.ZodDefault<z.ZodBoolean>;
        dlvJours: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        quantite: number;
        produitId: string;
        dlvJours: number;
        poidsUnitaire: number;
        mettreEnStock: boolean;
    }, {
        quantite: number;
        produitId: string;
        poidsUnitaire: number;
        dlvJours?: number | undefined;
        mettreEnStock?: boolean | undefined;
    }>, "many">>;
    patons: z.ZodDefault<z.ZodArray<z.ZodObject<{
        poids: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        poids: number;
    }, {
        poids: number;
    }>, "many">>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    patons: {
        poids: number;
    }[];
    numeroPetrin: number;
    sessionProd: "NUIT" | "JOUR";
    quantiteFarine: number;
    pateEffective: number;
    pateRetournee: number;
    pateRecuperee: number;
    pateGatee: number;
    pateGardee: number;
    categorieProd: "BOULANGERIE" | "VIENNOISERIE_PETRISSAGE" | "PATISSERIE";
    typeProduction: "VENTE" | "COMMANDE";
    recetteId: string;
    lignes: {
        quantite: number;
        produitId: string;
        dlvJours: number;
        poidsUnitaire: number;
        mettreEnStock: boolean;
    }[];
    estDernierPetrin: boolean;
    nomPetrisseur?: string | undefined;
    heureDebut?: string | undefined;
    heureFin?: string | undefined;
    causeGatee?: string | undefined;
    destinationPateGardee?: "recuperee_demain" | "gatee" | undefined;
    nomClient?: string | undefined;
    notes?: string | undefined;
}, {
    quantiteFarine: number;
    pateEffective: number;
    recetteId: string;
    patons?: {
        poids: number;
    }[] | undefined;
    numeroPetrin?: number | undefined;
    sessionProd?: "NUIT" | "JOUR" | undefined;
    nomPetrisseur?: string | undefined;
    heureDebut?: string | undefined;
    heureFin?: string | undefined;
    pateRetournee?: number | undefined;
    pateRecuperee?: number | undefined;
    pateGatee?: number | undefined;
    causeGatee?: string | undefined;
    pateGardee?: number | undefined;
    destinationPateGardee?: "recuperee_demain" | "gatee" | undefined;
    categorieProd?: "BOULANGERIE" | "VIENNOISERIE_PETRISSAGE" | "PATISSERIE" | undefined;
    typeProduction?: "VENTE" | "COMMANDE" | undefined;
    nomClient?: string | undefined;
    notes?: string | undefined;
    lignes?: {
        quantite: number;
        produitId: string;
        poidsUnitaire: number;
        dlvJours?: number | undefined;
        mettreEnStock?: boolean | undefined;
    }[] | undefined;
    estDernierPetrin?: boolean | undefined;
}>;
export declare function enregistrerProduction(companyId: string, userId: string, data: z.infer<typeof enregistrerProductionSchema>): Promise<{
    production: {
        difference: number;
        ecartPct: number;
        date: Date;
        id: string;
        createdAt: Date;
        companyId: string;
        userId: string;
        numeroPetrin: number;
        sessionProd: string;
        nomPetrisseur: string | null;
        heureDebut: Date | null;
        heureFin: Date | null;
        quantiteFarine: number;
        pateTheorique: number;
        pateEffective: number;
        pateRetournee: number;
        pateRecuperee: number;
        pateGatee: number;
        causeGatee: string | null;
        pateGardee: number;
        destinationPateGardee: string | null;
        categorieProd: import(".prisma/client").$Enums.CategorieProd;
        statut: import(".prisma/client").$Enums.StatutProduction;
        typeProduction: import(".prisma/client").$Enums.TypeProduction;
        nomClient: string | null;
        dateTerminaison: Date | null;
        notes: string | null;
        recetteId: string;
    };
    pateTheorique: number;
    pateEffective: number;
    difference: number;
    ecartPct: number;
    totalPieces: number;
    nbPatons: number;
    nbLots: number;
    alertesStock: {
        mp: string;
        stockActuel: number;
        besoin: number;
        manque: number;
    }[];
    alerteEcart: {
        niveau: string;
        message: string;
        ecartPct: number;
        difference: number;
    } | null;
    lots: {
        produitId: any;
        quantite: any;
        dateCreation: any;
        dateExpiration: any;
        dlvJours: any;
    }[];
    message: string;
}>;
export declare const faconnerPatonSchema: z.ZodObject<{
    patonId: z.ZodString;
    produitId: z.ZodString;
    poidsBeurre: z.ZodDefault<z.ZodNumber>;
    beurreMP: z.ZodOptional<z.ZodString>;
    nbPieces: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    produitId: string;
    poidsBeurre: number;
    nbPieces: number;
    patonId: string;
    notes?: string | undefined;
    beurreMP?: string | undefined;
}, {
    produitId: string;
    nbPieces: number;
    patonId: string;
    notes?: string | undefined;
    poidsBeurre?: number | undefined;
    beurreMP?: string | undefined;
}>;
export declare function faconnerPaton(companyId: string, data: z.infer<typeof faconnerPatonSchema>): Promise<{
    rendement: number;
    dlvJours: number;
    dateExpiration: Date;
    message: string;
}>;
export declare function getLotsActifs(companyId: string, produitId?: string): Promise<any>;
export declare function getPatonsEnChambreFroide(companyId: string): Promise<any[]>;
export declare function getDerniereRetournee(companyId: string): Promise<{
    [x: string]: {
        id: string;
        quantite: number;
        produitId: string;
        poidsUnitaire: number;
        poidsTotal: number;
        productionId: string;
    }[] | ({
        id: string;
        createdAt: Date;
        companyId: string;
        produitId: string | null;
        poids: number;
        poidsTotal: number;
        productionId: string;
        poidsBeurre: number;
        nbPieces: number;
        rendement: number;
        statutPaton: import(".prisma/client").$Enums.StatutPaton;
        dateFaconnage: Date | null;
    } | {
        id: string;
        createdAt: Date;
        companyId: string;
        produitId: string | null;
        poids: number;
        poidsTotal: number;
        productionId: string;
        poidsBeurre: number;
        nbPieces: number;
        rendement: number;
        statutPaton: import(".prisma/client").$Enums.StatutPaton;
        dateFaconnage: Date | null;
    })[] | ({
        id: string;
        createdAt: Date;
        companyId: string;
        statut: import(".prisma/client").$Enums.StatutLot;
        produitId: string;
        dlvJours: number;
        productionId: string | null;
        quantiteInitiale: number;
        quantiteRestante: number;
        dateCreation: Date;
        dateExpiration: Date;
        notesExpiration: string | null;
    } | {
        id: string;
        createdAt: Date;
        companyId: string;
        statut: import(".prisma/client").$Enums.StatutLot;
        produitId: string;
        dlvJours: number;
        productionId: string | null;
        quantiteInitiale: number;
        quantiteRestante: number;
        dateCreation: Date;
        dateExpiration: Date;
        notesExpiration: string | null;
    })[] | ({
        id: string;
        quantite: number;
        produitId: string;
        poidsUnitaire: number;
        poidsTotal: number;
        productionId: string;
    } | {
        id: string;
        quantite: number;
        produitId: string;
        poidsUnitaire: number;
        poidsTotal: number;
        productionId: string;
    })[] | {
        id: string;
        createdAt: Date;
        companyId: string;
        produitId: string | null;
        poids: number;
        poidsTotal: number;
        productionId: string;
        poidsBeurre: number;
        nbPieces: number;
        rendement: number;
        statutPaton: import(".prisma/client").$Enums.StatutPaton;
        dateFaconnage: Date | null;
    }[] | {
        id: string;
        createdAt: Date;
        companyId: string;
        statut: import(".prisma/client").$Enums.StatutLot;
        produitId: string;
        dlvJours: number;
        productionId: string | null;
        quantiteInitiale: number;
        quantiteRestante: number;
        dateCreation: Date;
        dateExpiration: Date;
        notesExpiration: string | null;
    }[];
    [x: number]: never;
    [x: symbol]: never;
} | null>;
export declare function getProchainNumeroPetrin(companyId: string): Promise<number>;
export declare function getProductions(companyId: string, options?: {
    categorieProd?: string;
    sessionProd?: string;
    dateDebut?: string;
    dateFin?: string;
}): Promise<({
    user: {
        prenom: string;
        nom: string;
    };
    recette: {
        id: string;
        nom: string;
        ratioPate: number;
    };
    patons: {
        id: string;
        poids: number;
        nbPieces: number;
        rendement: number;
        statutPaton: import(".prisma/client").$Enums.StatutPaton;
    }[];
    lignesProduction: ({
        produit: {
            nom: string;
        };
    } & {
        id: string;
        quantite: number;
        produitId: string;
        poidsUnitaire: number;
        poidsTotal: number;
        productionId: string;
    })[];
} & {
    date: Date;
    id: string;
    createdAt: Date;
    companyId: string;
    userId: string;
    numeroPetrin: number;
    sessionProd: string;
    nomPetrisseur: string | null;
    heureDebut: Date | null;
    heureFin: Date | null;
    quantiteFarine: number;
    pateTheorique: number;
    pateEffective: number;
    difference: number;
    ecartPct: number;
    pateRetournee: number;
    pateRecuperee: number;
    pateGatee: number;
    causeGatee: string | null;
    pateGardee: number;
    destinationPateGardee: string | null;
    categorieProd: import(".prisma/client").$Enums.CategorieProd;
    statut: import(".prisma/client").$Enums.StatutProduction;
    typeProduction: import(".prisma/client").$Enums.TypeProduction;
    nomClient: string | null;
    dateTerminaison: Date | null;
    notes: string | null;
    recetteId: string;
})[]>;
//# sourceMappingURL=production.service.d.ts.map