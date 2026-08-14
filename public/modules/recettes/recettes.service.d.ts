import { z } from "zod";
export declare const createRecetteSchema: z.ZodObject<{
    nom: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    ratioPate: z.ZodDefault<z.ZodNumber>;
    tauxPerte: z.ZodDefault<z.ZodNumber>;
    categorie: z.ZodOptional<z.ZodString>;
    estViennoiserie: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    ingredientReference: z.ZodOptional<z.ZodString>;
    ingredientReferenceNom: z.ZodOptional<z.ZodString>;
    ingredientReferenceUnite: z.ZodOptional<z.ZodString>;
    ingredients: z.ZodDefault<z.ZodArray<z.ZodObject<{
        mpId: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        quantite: z.ZodDefault<z.ZodNumber>;
        uniteId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        quantite: number;
        mpId: string;
        uniteId?: string | undefined;
    }, {
        quantite?: number | undefined;
        uniteId?: string | undefined;
        mpId?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    nom: string;
    ratioPate: number;
    tauxPerte: number;
    estViennoiserie: boolean;
    ingredients: {
        quantite: number;
        mpId: string;
        uniteId?: string | undefined;
    }[];
    categorie?: string | undefined;
    description?: string | undefined;
    ingredientReference?: string | undefined;
    ingredientReferenceNom?: string | undefined;
    ingredientReferenceUnite?: string | undefined;
}, {
    nom: string;
    categorie?: string | undefined;
    description?: string | undefined;
    ratioPate?: number | undefined;
    tauxPerte?: number | undefined;
    estViennoiserie?: boolean | undefined;
    ingredientReference?: string | undefined;
    ingredientReferenceNom?: string | undefined;
    ingredientReferenceUnite?: string | undefined;
    ingredients?: {
        quantite?: number | undefined;
        uniteId?: string | undefined;
        mpId?: string | undefined;
    }[] | undefined;
}>;
export declare const updateRecetteSchema: z.ZodObject<{
    nom: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    ratioPate: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    tauxPerte: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    categorie: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    estViennoiserie: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodBoolean>>>;
    ingredientReference: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    ingredientReferenceNom: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    ingredientReferenceUnite: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    ingredients: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
        mpId: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        quantite: z.ZodDefault<z.ZodNumber>;
        uniteId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        quantite: number;
        mpId: string;
        uniteId?: string | undefined;
    }, {
        quantite?: number | undefined;
        uniteId?: string | undefined;
        mpId?: string | undefined;
    }>, "many">>>;
}, "strip", z.ZodTypeAny, {
    nom?: string | undefined;
    categorie?: string | undefined;
    description?: string | undefined;
    ratioPate?: number | undefined;
    tauxPerte?: number | undefined;
    estViennoiserie?: boolean | undefined;
    ingredientReference?: string | undefined;
    ingredientReferenceNom?: string | undefined;
    ingredientReferenceUnite?: string | undefined;
    ingredients?: {
        quantite: number;
        mpId: string;
        uniteId?: string | undefined;
    }[] | undefined;
}, {
    nom?: string | undefined;
    categorie?: string | undefined;
    description?: string | undefined;
    ratioPate?: number | undefined;
    tauxPerte?: number | undefined;
    estViennoiserie?: boolean | undefined;
    ingredientReference?: string | undefined;
    ingredientReferenceNom?: string | undefined;
    ingredientReferenceUnite?: string | undefined;
    ingredients?: {
        quantite?: number | undefined;
        uniteId?: string | undefined;
        mpId?: string | undefined;
    }[] | undefined;
}>;
export type CreateRecetteInput = z.infer<typeof createRecetteSchema>;
export declare function getRecettes(companyId: string): Promise<any[]>;
export declare function createRecette(companyId: string, data: CreateRecetteInput): Promise<any>;
export declare function updateRecette(recetteId: string, companyId: string, data: Partial<CreateRecetteInput>): Promise<any>;
export declare function dupliquerRecette(recetteId: string, companyId: string): Promise<any>;
export declare function archiverRecette(recetteId: string, companyId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    nom: string;
    actif: boolean;
    companyId: string;
    categorie: string | null;
    description: string | null;
    ratioPate: number;
    tauxPerte: number;
    estViennoiserie: boolean;
    ingredientReference: string;
    ingredientReferenceNom: string;
    ingredientReferenceUnite: string;
}>;
//# sourceMappingURL=recettes.service.d.ts.map