// ═══════════════════════════════════════════════════════════════
// src/types/models.ts
// Tous les types TypeScript du projet frontend
//
// Ces types correspondent aux modèles Prisma du backend.
// Les garder synchronisés évite des bugs au moment des appels API.
// ═══════════════════════════════════════════════════════════════

// ─── Rôles utilisateur ───────────────────────────────────────────
export type Role =
  | "ADMIN"
  | "RESPONSABLE"
  | "CHEF_PATISSIER"
  | "GESTIONNAIRE"
  | "CAISSIER"
  | "COMPTABLE";

// ─── Entreprise ──────────────────────────────────────────────────
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

// ─── Utilisateur ─────────────────────────────────────────────────
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

// ─── Authentification ─────────────────────────────────────────────
// Ce que le store d'auth contient après la connexion
export interface AuthState {
  token: string | null;
  user: Omit<User, "companyId" | "actif" | "createdAt"> | null;
  company: Pick<Company, "id" | "nom" | "couleurPrincipale" | "devise" | "logoUrl"> | null;
  isAuthenticated: boolean;
  isOnboardingDone: boolean; // true si l'entreprise existe déjà
}

// ─── Catégorie ────────────────────────────────────────────────────
export interface Categorie {
  id: string;
  nom: string;
  type: "PRODUIT" | "MATIERE_PREMIERE";
  margeMin?: number;
}

// ─── Unité de mesure ─────────────────────────────────────────────
export interface Unite {
  id: string;
  nom: string;
  abreviation: string;
  type: "MASSE" | "VOLUME" | "COMPTAGE" | "CONDITIONNEMENT";
  uniteBase: string;
  coefficient: number;
}

// ─── Fournisseur ──────────────────────────────────────────────────
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
  matieresPremières?: { id: string; nom: string }[];
}

// ─── Matière première ─────────────────────────────────────────────
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
  // Calculé côté backend selon le stock/seuil
  statut: "OK" | "BAS" | "CRITIQUE" | "RUPTURE";
}

// ─── Recette ──────────────────────────────────────────────────────
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
  produits?: { id: string; nom: string }[];
  coutMP: number; // Calculé dynamiquement par le backend
}

// ─── Produit ──────────────────────────────────────────────────────
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
  // Champs calculés par le backend
  coutMP?: number;
  margeValeur?: number;
  margePct?: number;
}

// ─── Production ───────────────────────────────────────────────────
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
  recette: { nom: string };
  user: { prenom: string; nom: string };
}

// ─── Vente ────────────────────────────────────────────────────────
export type ModePaiement =
  | "ESPECES"
  | "MOBILE_MONEY"
  | "CARTE_BANCAIRE"
  | "VIREMENT"
  | "AUTRE";

export interface LigneVente {
  id: string;
  quantite: number;
  prixUnitaire: number;
  sousTotal: number;
  produit: { nom: string };
}

export interface Vente {
  id: string;
  montantTotal: number;
  modePaiement: ModePaiement;
  date: string;
  notes?: string;
  lignes: LigneVente[];
  user: { prenom: string; nom: string };
}

// ─── Perte ────────────────────────────────────────────────────────
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
  produit?: { nom: string };
  mp?: { nom: string };
}

// ─── Réponse API standard ─────────────────────────────────────────
// Toutes les réponses du backend suivent ce format
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

// ─── Statistiques dashboard ───────────────────────────────────────
export interface DashboardData {
  caAujourdhui: number;
  nbTransactionsAujourdhui: number;
  pertesAujourdhui: number;
  productionsAujourdhui: Production[];
  alertesStock: MatierePremiere[];
  dernieresVentes: Vente[];
}