export type Role = "ADMIN" | "RESPONSABLE" | "CHEF_PATISSIER" | "GESTIONNAIRE" | "CAISSIER" | "COMPTABLE";
export interface Company {
    id: string;
    nom: string;
    type: string;
    adresse?: string;
    ville?: string;
    pays?: string;
    telephone?: string;
    email?: string;
    siteWeb?: string;
    logoUrl?: string;
    devise: string;
    couleurPrincipale: string;
    createdAt: string;
}
export interface User {
    id: string;
    prenom: string;
    nom: string;
    email: string;
    role: Role;
    actif: boolean;
    companyId: string;
    createdAt: string;
}
export interface AuthState {
    token: string | null;
    user: Omit<User, "companyId" | "actif" | "createdAt"> | null;
    company: Pick<Company, "id" | "nom" | "couleurPrincipale" | "devise" | "logoUrl"> | null;
    isAuthenticated: boolean;
    isOnboardingDone: boolean;
}
export interface Categorie {
    id: string;
    nom: string;
    type: "PRODUIT" | "MATIERE_PREMIERE";
    margeMin?: number;
}
export interface Unite {
    id: string;
    nom: string;
    abreviation: string;
    type: "MASSE" | "VOLUME" | "COMPTAGE" | "CONDITIONNEMENT";
    uniteBase: string;
    coefficient: number;
}
export interface Fournisseur {
    id: string;
    nom: string;
    contact?: string;
    telephone?: string;
    email?: string;
    adresse?: string;
    delaiLivraison?: string;
    conditionsPaiement?: string;
    actif: boolean;
    matieresPremières?: {
        id: string;
        nom: string;
    }[];
}
export interface MatierePremiere {
    id: string;
    nom: string;
    prixAchat: number;
    stockActuel: number;
    seuilAlerte: number;
    actif: boolean;
    categorie?: Categorie;
    unite?: Unite;
    fournisseur?: Fournisseur;
    statut: "OK" | "BAS" | "CRITIQUE" | "RUPTURE";
}
export interface RecetteIngredient {
    id: string;
    quantite: number;
    mp: MatierePremiere;
    unite?: Unite;
}
export interface Recette {
    id: string;
    nom: string;
    description?: string;
    ratioPate: number;
    actif: boolean;
    ingredients: RecetteIngredient[];
    produits?: {
        id: string;
        nom: string;
    }[];
    coutMP: number;
}
export interface Produit {
    id: string;
    nom: string;
    prixVente: number;
    prixAchat?: number;
    margeMin: number;
    grammage?: number;
    stockActuel?: number;
    stockReserve?: number;
    seuilAlerte?: number;
    dlvJours?: number;
    actif: boolean;
    imageUrl?: string | null;
    estSemiFini?: boolean;
    categorie?: Categorie;
    recette?: Recette;
    coutMP?: number;
    margeValeur?: number;
    margePct?: number;
}
export interface Production {
    id: string;
    quantiteFarine: number;
    pateTheorique: number;
    pateReelle: number;
    ecartKg: number;
    ecartPct: number;
    date: string;
    notes?: string;
    statut: "OK" | "ATTENTION" | "CRITIQUE";
    recette: {
        nom: string;
    };
    user: {
        prenom: string;
        nom: string;
    };
}
export type ModePaiement = "ESPECES" | "MOBILE_MONEY" | "CARTE_BANCAIRE" | "VIREMENT" | "AUTRE";
export interface LigneVente {
    id: string;
    quantite: number;
    prixUnitaire: number;
    sousTotal: number;
    produit: {
        nom: string;
    };
}
export interface Vente {
    id: string;
    montantTotal: number;
    modePaiement: ModePaiement;
    date: string;
    notes?: string;
    lignes: LigneVente[];
    user: {
        prenom: string;
        nom: string;
    };
}
export type TypePerte = "PRODUIT_FINI" | "MATIERE_PREMIERE";
export interface Perte {
    id: string;
    type: TypePerte;
    quantite: number;
    valeur: number;
    cause: string;
    deductMP: boolean;
    date: string;
    notes?: string;
    produit?: {
        nom: string;
    };
    mp?: {
        nom: string;
    };
}
export interface ApiResponse<T> {
    success: boolean;
    message?: string;
    data: T;
}
export interface DashboardData {
    caAujourdhui: number;
    nbTransactionsAujourdhui: number;
    pertesAujourdhui: number;
    productionsAujourdhui: Production[];
    alertesStock: MatierePremiere[];
    dernieresVentes: Vente[];
}
//# sourceMappingURL=models.d.ts.map