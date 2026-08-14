import { z } from "zod";
export declare const updateCompanySchema: z.ZodObject<{
    nom: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
    adresse: z.ZodOptional<z.ZodString>;
    ville: z.ZodOptional<z.ZodString>;
    pays: z.ZodOptional<z.ZodString>;
    telephone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    siteWeb: z.ZodOptional<z.ZodString>;
    devise: z.ZodOptional<z.ZodString>;
    couleurPrincipale: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type?: string | undefined;
    nom?: string | undefined;
    email?: string | undefined;
    adresse?: string | undefined;
    ville?: string | undefined;
    pays?: string | undefined;
    telephone?: string | undefined;
    siteWeb?: string | undefined;
    devise?: string | undefined;
    couleurPrincipale?: string | undefined;
}, {
    type?: string | undefined;
    nom?: string | undefined;
    email?: string | undefined;
    adresse?: string | undefined;
    ville?: string | undefined;
    pays?: string | undefined;
    telephone?: string | undefined;
    siteWeb?: string | undefined;
    devise?: string | undefined;
    couleurPrincipale?: string | undefined;
}>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export declare function getCompany(companyId: string): Promise<{
    type: string;
    id: string;
    createdAt: Date;
    nom: string;
    email: string | null;
    adresse: string | null;
    ville: string | null;
    pays: string | null;
    telephone: string | null;
    siteWeb: string | null;
    devise: string;
    couleurPrincipale: string;
    logoUrl: string | null;
}>;
export declare function updateCompany(companyId: string, data: UpdateCompanyInput): Promise<{
    type: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    nom: string;
    email: string | null;
    adresse: string | null;
    ville: string | null;
    pays: string | null;
    telephone: string | null;
    siteWeb: string | null;
    devise: string;
    couleurPrincipale: string;
    logoUrl: string | null;
    heureCloture: string;
    objectifCA: number;
    seuilPertes: number;
    chargesFixesMensuelles: number;
    plan: import(".prisma/client").$Enums.Plan;
    statutAbonnement: import(".prisma/client").$Enums.StatutAbonnement;
    dateFinEssai: Date | null;
    dateProchainPaiement: Date | null;
    montantAbonnement: number;
}>;
export declare function uploadLogo(companyId: string, fileBuffer: Buffer, mimetype: string): Promise<string>;
export declare function getDashboardData(companyId: string): Promise<{
    caAujourdhui: number;
    nbTransactionsAujourdhui: number;
    pertesAujourdhui: number;
    productionsAujourdhui: {
        id: string;
        recette: {
            nom: string;
        };
        quantiteFarine: number;
        pateTheorique: number;
        pateEffective: number;
        ecartPct: number;
    }[];
    alertesStock: {
        id: string;
        nom: string;
        stockActuel: number;
        seuilAlerte: number;
    }[];
    dernieresVentes: {
        date: Date;
        user: {
            prenom: string;
            nom: string;
        };
        id: string;
        montantTotal: number;
        modePaiement: import(".prisma/client").$Enums.ModePaiement;
        lignes: {
            produit: {
                nom: string;
            };
            quantite: number;
            sousTotal: number;
        }[];
    }[];
    topProduits: {
        produitId: string;
        nom: string;
        quantite: number;
        ca: number;
    }[];
    objectifCA: number;
    seuilPertes: number;
}>;
//# sourceMappingURL=company.service.d.ts.map