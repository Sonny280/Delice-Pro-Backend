import { z } from "zod";
export declare const registerCompanySchema: z.ZodObject<{
    company: z.ZodObject<{
        nom: z.ZodString;
        type: z.ZodDefault<z.ZodString>;
        adresse: z.ZodOptional<z.ZodString>;
        ville: z.ZodOptional<z.ZodString>;
        pays: z.ZodOptional<z.ZodString>;
        telephone: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        siteWeb: z.ZodOptional<z.ZodString>;
        devise: z.ZodDefault<z.ZodString>;
        couleurPrincipale: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        nom: string;
        devise: string;
        couleurPrincipale: string;
        email?: string | undefined;
        adresse?: string | undefined;
        ville?: string | undefined;
        pays?: string | undefined;
        telephone?: string | undefined;
        siteWeb?: string | undefined;
    }, {
        nom: string;
        type?: string | undefined;
        email?: string | undefined;
        adresse?: string | undefined;
        ville?: string | undefined;
        pays?: string | undefined;
        telephone?: string | undefined;
        siteWeb?: string | undefined;
        devise?: string | undefined;
        couleurPrincipale?: string | undefined;
    }>;
    admin: z.ZodObject<{
        prenom: z.ZodString;
        nom: z.ZodString;
        email: z.ZodString;
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        prenom: string;
        nom: string;
        email: string;
        password: string;
    }, {
        prenom: string;
        nom: string;
        email: string;
        password: string;
    }>;
}, "strip", z.ZodTypeAny, {
    company: {
        type: string;
        nom: string;
        devise: string;
        couleurPrincipale: string;
        email?: string | undefined;
        adresse?: string | undefined;
        ville?: string | undefined;
        pays?: string | undefined;
        telephone?: string | undefined;
        siteWeb?: string | undefined;
    };
    admin: {
        prenom: string;
        nom: string;
        email: string;
        password: string;
    };
}, {
    company: {
        nom: string;
        type?: string | undefined;
        email?: string | undefined;
        adresse?: string | undefined;
        ville?: string | undefined;
        pays?: string | undefined;
        telephone?: string | undefined;
        siteWeb?: string | undefined;
        devise?: string | undefined;
        couleurPrincipale?: string | undefined;
    };
    admin: {
        prenom: string;
        nom: string;
        email: string;
        password: string;
    };
}>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    companyId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    companyId?: string | undefined;
}, {
    email: string;
    password: string;
    companyId?: string | undefined;
}>;
export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export declare function registerCompany(data: RegisterCompanyInput): Promise<{
    token: string;
    company: {
        id: string;
        nom: string;
        couleurPrincipale: string;
        devise: string;
    };
    user: {
        id: string;
        prenom: string;
        nom: string;
        email: string;
        role: import(".prisma/client").$Enums.Role;
    };
}>;
export declare function login(data: LoginInput): Promise<{
    token: string;
    company: {
        id: string;
        nom: string;
        devise: string;
        couleurPrincipale: string;
    };
    user: {
        id: string;
        prenom: string;
        nom: string;
        email: string;
        username: any;
        role: import(".prisma/client").$Enums.Role;
    };
}>;
export declare function generateToken(userId: string, companyId: string, role: string, email: string): string;
//# sourceMappingURL=auth.service.d.ts.map