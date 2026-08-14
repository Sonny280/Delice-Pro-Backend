import { z } from "zod";
export declare const createMPSchema: z.ZodObject<{
    nom: z.ZodString;
    prixAchat: z.ZodNumber;
    stockActuel: z.ZodDefault<z.ZodNumber>;
    seuilAlerte: z.ZodNumber;
    categorieId: z.ZodOptional<z.ZodString>;
    uniteId: z.ZodOptional<z.ZodString>;
    fournisseurId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    nom: string;
    prixAchat: number;
    stockActuel: number;
    seuilAlerte: number;
    categorieId?: string | undefined;
    uniteId?: string | undefined;
    fournisseurId?: string | undefined;
}, {
    nom: string;
    prixAchat: number;
    seuilAlerte: number;
    stockActuel?: number | undefined;
    categorieId?: string | undefined;
    uniteId?: string | undefined;
    fournisseurId?: string | undefined;
}>;
export declare const updateMPSchema: z.ZodObject<{
    nom: z.ZodOptional<z.ZodString>;
    prixAchat: z.ZodOptional<z.ZodNumber>;
    stockActuel: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    seuilAlerte: z.ZodOptional<z.ZodNumber>;
    categorieId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    uniteId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    fournisseurId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    nom?: string | undefined;
    prixAchat?: number | undefined;
    stockActuel?: number | undefined;
    seuilAlerte?: number | undefined;
    categorieId?: string | undefined;
    uniteId?: string | undefined;
    fournisseurId?: string | undefined;
}, {
    nom?: string | undefined;
    prixAchat?: number | undefined;
    stockActuel?: number | undefined;
    seuilAlerte?: number | undefined;
    categorieId?: string | undefined;
    uniteId?: string | undefined;
    fournisseurId?: string | undefined;
}>;
export declare const entreeStockSchema: z.ZodObject<{
    mpId: z.ZodString;
    quantite: z.ZodNumber;
    motif: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    quantite: number;
    mpId: string;
    motif?: string | undefined;
}, {
    quantite: number;
    mpId: string;
    motif?: string | undefined;
}>;
export type CreateMPInput = z.infer<typeof createMPSchema>;
export type UpdateMPInput = z.infer<typeof updateMPSchema>;
export type EntreeStockInput = z.infer<typeof entreeStockSchema>;
export declare function getMPList(companyId: string): Promise<{
    statut: string;
    categorie: {
        id: string;
        nom: string;
    } | null;
    unite: {
        id: string;
        nom: string;
        abreviation: string;
    } | null;
    fournisseur: {
        id: string;
        nom: string;
    } | null;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    nom: string;
    actif: boolean;
    companyId: string;
    prixAchat: number;
    stockActuel: number;
    seuilAlerte: number;
    categorieId: string | null;
    stockGere: boolean;
    uniteId: string | null;
    fournisseurId: string | null;
}[]>;
export declare function createMP(companyId: string, data: CreateMPInput): Promise<{
    categorie: {
        type: import(".prisma/client").$Enums.TypeCategorie;
        id: string;
        createdAt: Date;
        nom: string;
        companyId: string;
        margeMin: number | null;
    } | null;
    unite: {
        type: import(".prisma/client").$Enums.TypeUnite;
        id: string;
        createdAt: Date;
        nom: string;
        companyId: string;
        abreviation: string;
        uniteBase: string;
        coefficient: number;
    } | null;
    fournisseur: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        nom: string;
        email: string | null;
        actif: boolean;
        companyId: string;
        adresse: string | null;
        telephone: string | null;
        contact: string | null;
        delaiLivraison: string | null;
        conditionsPaiement: string | null;
    } | null;
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    nom: string;
    actif: boolean;
    companyId: string;
    prixAchat: number;
    stockActuel: number;
    seuilAlerte: number;
    categorieId: string | null;
    stockGere: boolean;
    uniteId: string | null;
    fournisseurId: string | null;
}>;
export declare function updateMP(mpId: string, companyId: string, data: UpdateMPInput): Promise<{
    categorie: {
        type: import(".prisma/client").$Enums.TypeCategorie;
        id: string;
        createdAt: Date;
        nom: string;
        companyId: string;
        margeMin: number | null;
    } | null;
    unite: {
        type: import(".prisma/client").$Enums.TypeUnite;
        id: string;
        createdAt: Date;
        nom: string;
        companyId: string;
        abreviation: string;
        uniteBase: string;
        coefficient: number;
    } | null;
    fournisseur: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        nom: string;
        email: string | null;
        actif: boolean;
        companyId: string;
        adresse: string | null;
        telephone: string | null;
        contact: string | null;
        delaiLivraison: string | null;
        conditionsPaiement: string | null;
    } | null;
} & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    nom: string;
    actif: boolean;
    companyId: string;
    prixAchat: number;
    stockActuel: number;
    seuilAlerte: number;
    categorieId: string | null;
    stockGere: boolean;
    uniteId: string | null;
    fournisseurId: string | null;
}>;
export declare function entreeStock(companyId: string, data: EntreeStockInput): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    nom: string;
    actif: boolean;
    companyId: string;
    prixAchat: number;
    stockActuel: number;
    seuilAlerte: number;
    categorieId: string | null;
    stockGere: boolean;
    uniteId: string | null;
    fournisseurId: string | null;
}>;
export declare function deleteMP(mpId: string, companyId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    nom: string;
    actif: boolean;
    companyId: string;
    prixAchat: number;
    stockActuel: number;
    seuilAlerte: number;
    categorieId: string | null;
    stockGere: boolean;
    uniteId: string | null;
    fournisseurId: string | null;
}>;
export declare function getMouvementsStock(mpId: string, companyId: string): Promise<{
    type: import(".prisma/client").$Enums.TypeMouvement;
    id: string;
    createdAt: Date;
    quantite: number;
    mpId: string;
    motif: string | null;
}[]>;
//# sourceMappingURL=mp.service.d.ts.map