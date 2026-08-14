"use strict";
// ═══════════════════════════════════════════════════════════════
// src/app.ts
// Configuration de l'application Express
// ═══════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
require("express-async-errors");
const env_1 = require("./config/env");
const error_middleware_1 = require("./middleware/error.middleware");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const company_routes_1 = __importDefault(require("./modules/company/company.routes"));
const users_routes_1 = __importDefault(require("./modules/users/users.routes"));
const categories_routes_1 = __importDefault(require("./modules/categories/categories.routes"));
const unites_routes_1 = __importDefault(require("./modules/unites/unites.routes"));
const fournisseurs_routes_1 = __importDefault(require("./modules/fournisseurs/fournisseurs.routes"));
const mp_routes_1 = __importDefault(require("./modules/mp/mp.routes"));
const recettes_routes_1 = __importDefault(require("./modules/recettes/recettes.routes"));
const produits_routes_1 = __importDefault(require("./modules/produits/produits.routes"));
const production_routes_1 = __importDefault(require("./modules/production/production.routes"));
const ventes_routes_1 = __importDefault(require("./modules/ventes/ventes.routes"));
const marges_routes_1 = __importDefault(require("./modules/marges/marges.routes"));
const pertes_routes_1 = __importDefault(require("./modules/pertes/pertes.routes"));
const clients_routes_1 = __importDefault(require("./modules/clients/clients.routes"));
const commandesClient_routes_1 = __importDefault(require("./modules/commandesClient/commandesClient.routes"));
const commandesFournisseur_routes_1 = __importDefault(require("./modules/commandesFournisseur/commandesFournisseur.routes"));
const rapports_routes_1 = __importDefault(require("./modules/rapports/rapports.routes"));
const planification_routes_1 = __importDefault(require("./modules/planification/planification.routes"));
const favoris_routes_1 = __importDefault(require("./modules/favoris/favoris.routes"));
const cloture_routes_1 = __importDefault(require("./modules/cloture/cloture.routes"));
const abonnement_routes_1 = __importDefault(require("./modules/abonnement/abonnement.routes"));
const charges_routes_1 = __importDefault(require("./modules/charges/charges.routes"));
const import_routes_1 = __importDefault(require("./modules/import/import.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: env_1.env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Device-Id"],
}));
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
if (env_1.env.NODE_ENV !== "test") {
    app.use((0, morgan_1.default)(env_1.env.NODE_ENV === "development" ? "dev" : "combined"));
}
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        env: env_1.env.NODE_ENV,
    });
});
// Route ping — DOIT être définie ici, avant tous les autres routeurs.
// Utilisée par Electron (main.js) pour savoir quand le backend est prêt.
// Elle était avant définie dans server.ts, APRÈS l'import de app.ts —
// mais comme le gestionnaire 404 final est déjà attaché à ce moment-là,
// la route n'était jamais atteinte (toujours interceptée par le 404
// générique, ajouté en premier dans la pile de middlewares Express).
app.get("/api/auth/ping", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", auth_routes_1.default);
app.use("/api/company", company_routes_1.default);
app.use("/api/users", users_routes_1.default);
app.use("/api/categories", categories_routes_1.default);
app.use("/api/unites", unites_routes_1.default);
app.use("/api/fournisseurs", fournisseurs_routes_1.default);
app.use("/api/mp", mp_routes_1.default);
app.use("/api/recettes", recettes_routes_1.default);
app.use("/api/produits", produits_routes_1.default);
app.use("/api/production", production_routes_1.default);
app.use("/api/ventes", ventes_routes_1.default);
app.use("/api/marges", marges_routes_1.default);
app.use("/api/pertes", pertes_routes_1.default);
app.use("/api/clients", clients_routes_1.default);
app.use("/api/commandes-client", commandesClient_routes_1.default);
app.use("/api/commandes-fournisseur", commandesFournisseur_routes_1.default);
app.use("/api/rapports", rapports_routes_1.default);
app.use("/api/planification", planification_routes_1.default);
app.use("/api/cloture", cloture_routes_1.default);
app.use("/api/favoris", favoris_routes_1.default);
app.use("/api/abonnement", abonnement_routes_1.default);
app.use("/api/charges", charges_routes_1.default);
app.use("/api/import", import_routes_1.default);
// ── AJOUT ELECTRON ───────────────────────────────────────────────
// Sert le frontend compile (React) quand l'app est packagee.
// En developpement, backend/public/ n'existe pas, donc ce code
// ne s'execute jamais et le mode dev n'est pas affecte.
const publicDir = path_1.default.join(__dirname, "..", "public");
if (fs_1.default.existsSync(publicDir)) {
    app.use(express_1.default.static(publicDir));
    app.get(/^(?!\/api).*/, (_req, res) => {
        res.sendFile(path_1.default.join(publicDir, "index.html"));
    });
}
// ── FIN AJOUT ELECTRON ───────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: "Route introuvable",
    });
});
app.use(error_middleware_1.errorMiddleware);
exports.default = app;
//# sourceMappingURL=app.js.map