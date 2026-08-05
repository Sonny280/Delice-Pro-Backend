import { z } from "zod";
export declare const createPerteProduitSchema: z.ZodObject<{
    produitId: z.ZodString;
    quantite: z.ZodNumber;
    cause: z.ZodString;
    date: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    deductMP: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    quantite: number;
    produitId: string;
    cause: string;
    deductMP: boolean;
    date?: string | undefined;
    notes?: string | undefined;
}, {
    quantite: number;
    produitId: string;
    cause: string;
    date?: string | undefined;
    notes?: string | undefined;
    deductMP?: boolean | undefined;
}>;
export declare const createPerteMPSchema: z.ZodObject<{
    mpId: z.ZodString;
    quantite: z.ZodNumber;
    cause: z.ZodString;
    date: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    quantite: number;
    mpId: string;
    cause: string;
    date?: string | undefined;
    notes?: string | undefined;
}, {
    quantite: number;
    mpId: string;
    cause: string;
    date?: string | undefined;
    notes?: string | undefined;
}>;
export type CreatePerteProduitInput = z.infer<typeof createPerteProduitSchema>;
export type CreatePerteMPInput = z.infer<typeof createPerteMPSchema>;
export declare const CAUSES_PRODUIT_FINI: string[];
export declare const CAUSES_MATIERE_PREMIERE: string[];
export declare function createPerteProduit(companyId: string, data: CreatePerteProduitInput): Promise<{
    perte: {
        produit: {
            nom: string;
            prixVente: number;
        } | null;
    } & {
        type: import(".prisma/client").$Enums.TypePerte;
        date: Date;
        id: string;
        createdAt: Date;
        companyId: string;
        valeur: number;
        notes: string | null;
        quantite: number;
        produitId: string | null;
        mpId: string | null;
        cause: string;
        deductMP: boolean;
        origine: import(".prisma/client").$Enums.OriginePerte;
    };
    valeur: number;
    impactsMP: {
        mpId: string;
        mpNom: string;
        quantiteADeduire: number;
    }[];
    message: string;
}>;
export declare function createPerteMP(companyId: string, data: CreatePerteMPInput): Promise<{
    perte: {
        mp: {
            nom: string;
            prixAchat: number;
        } | null;
    } & {
        type: import(".prisma/client").$Enums.TypePerte;
        date: Date;
        id: string;
        createdAt: Date;
        companyId: string;
        valeur: number;
        notes: string | null;
        quantite: number;
        produitId: string | null;
        mpId: string | null;
        cause: string;
        deductMP: boolean;
        origine: import(".prisma/client").$Enums.OriginePerte;
    };
    valeur: number;
    message: string;
}>;
export declare function getPertes(companyId: string, options?: {
    type?: "PRODUIT_FINI" | "MATIERE_PREMIERE";
    cause?: string;
    dateDebut?: string;
    dateFin?: string;
    limit?: number;
}): Promise<{
    pertes: ({
        produit: {
            nom: string;
            prixVente: number;
        } | null;
        mp: {
            nom: string;
            prixAchat: number;
        } | null;
    } & {
        type: import(".prisma/client").$Enums.TypePerte;
        date: Date;
        id: string;
        createdAt: Date;
        companyId: string;
        valeur: number;
        notes: string | null;
        quantite: number;
        produitId: string | null;
        mpId: string | null;
        cause: string;
        deductMP: boolean;
        origine: import(".prisma/client").$Enums.OriginePerte;
    })[];
    stats: {
        totalValeurProduits: number;
        totalValeurMP: number;
        totalValeur: number;
        nbPertes: number;
        topCauses: {
            cause: string;
            count: number;
            valeur: number;
        }[];
        parJour: Record<string, number>;
        topProduitPerdu: {
            nom: string;
            count: number;
            valeur: number;
        };
        mois: {
            valeur: number;
            count: number;
        };
    };
}>;
//# sourceMappingURL=pertes.service.d.ts.map