// ═══════════════════════════════════════════════════════════════
// src/app.ts
// Configuration de l'application Express
// ═══════════════════════════════════════════════════════════════

import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import fs from "fs";
import "express-async-errors";

import { env } from "./config/env";
import { errorMiddleware } from "./middleware/error.middleware";

import authRoutes from "./modules/auth/auth.routes";
import companyRoutes from "./modules/company/company.routes";
import usersRoutes from "./modules/users/users.routes";
import categoriesRoutes from "./modules/categories/categories.routes";
import unitesRoutes from "./modules/unites/unites.routes";
import fournisseursRoutes from "./modules/fournisseurs/fournisseurs.routes";
import mpRoutes from "./modules/mp/mp.routes";
import recettesRoutes from "./modules/recettes/recettes.routes";
import produitsRoutes from "./modules/produits/produits.routes";
import productionRoutes from "./modules/production/production.routes";
import ventesRoutes from "./modules/ventes/ventes.routes";
import margesRoutes from "./modules/marges/marges.routes";
import pertesRoutes from "./modules/pertes/pertes.routes";
import clientsRoutes from "./modules/clients/clients.routes";
import commandesClientRoutes from "./modules/commandesClient/commandesClient.routes";
import commandesFournisseurRoutes from "./modules/commandesFournisseur/commandesFournisseur.routes";
import rapportsRoutes from "./modules/rapports/rapports.routes";
import planificationRoutes from "./modules/planification/planification.routes";
import favorisRoutes      from "./modules/favoris/favoris.routes";
import clotureRoutes from "./modules/cloture/cloture.routes";
import abonnementRoutes from "./modules/abonnement/abonnement.routes";
import chargesRoutes from "./modules/charges/charges.routes";

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Device-Id"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

if (env.NODE_ENV !== "test") {
  app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

// Route ping — DOIT être définie ici, avant tous les autres routeurs.
// Utilisée par Electron (main.js) pour savoir quand le backend est prêt.
// Elle était avant définie dans server.ts, APRÈS l'import de app.ts —
// mais comme le gestionnaire 404 final est déjà attaché à ce moment-là,
// la route n'était jamais atteinte (toujours interceptée par le 404
// générique, ajouté en premier dans la pile de middlewares Express).
app.get("/api/auth/ping", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/unites", unitesRoutes);
app.use("/api/fournisseurs", fournisseursRoutes);
app.use("/api/mp", mpRoutes);
app.use("/api/recettes", recettesRoutes);
app.use("/api/produits", produitsRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/ventes", ventesRoutes);
app.use("/api/marges", margesRoutes);
app.use("/api/pertes", pertesRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/commandes-client", commandesClientRoutes);
app.use("/api/commandes-fournisseur", commandesFournisseurRoutes);
app.use("/api/rapports", rapportsRoutes);
app.use("/api/planification", planificationRoutes);
app.use("/api/cloture",        clotureRoutes);
app.use("/api/favoris",        favorisRoutes);
app.use("/api/abonnement",     abonnementRoutes);
app.use("/api/charges",        chargesRoutes);

// ── AJOUT ELECTRON ───────────────────────────────────────────────
// Sert le frontend compile (React) quand l'app est packagee.
// En developpement, backend/public/ n'existe pas, donc ce code
// ne s'execute jamais et le mode dev n'est pas affecte.
const publicDir = path.join(__dirname, "..", "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}
// ── FIN AJOUT ELECTRON ───────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route introuvable",
  });
});

app.use(errorMiddleware);

export default app;

