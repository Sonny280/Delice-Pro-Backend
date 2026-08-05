import { Request, Response, NextFunction } from "express";
type Role = "ADMIN" | "RESPONSABLE" | "CHEF_PATISSIER" | "GESTIONNAIRE" | "COMPTABLE" | "CAISSIER";
export declare const authMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireRole: (roles: Role[]) => (req: Request, res: Response, next: NextFunction) => void;
export declare const requirePlan: (plans: ("ESSAI" | "STANDARD" | "PRO")[]) => (req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=auth.middleware.d.ts.map