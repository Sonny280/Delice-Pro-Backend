"use strict";
// ═══════════════════════════════════════════════════════════════
// src/server.ts
// Point d'entrée du serveur
// ═══════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const database_1 = __importDefault(require("./config/database"));
// Route ping déplacée dans app.ts (voir ce fichier) — elle devait être
// définie AVANT le gestionnaire 404 final, qui est déjà en place au
// moment où ce fichier s'exécute.
async function startServer() {
    try {
        await database_1.default.$connect();
        console.log("Connexion a la base de donnees etablie");
        // En mode DESKTOP, le plan (STANDARD/PRO) vient de la licence vérifiée
        // par Electron (main.js), pas d'un abonnement en ligne. On synchronise
        // Company.plan à CHAQUE démarrage : si le client active une nouvelle
        // licence (upgrade Standard → Pro), un simple redémarrage de l'app
        // suffit à débloquer les fonctionnalités correspondantes.
        // Ce champ n'est jamais modifiable depuis l'interface elle-même
        // (aucune route ne l'expose) — seule cette synchronisation le change.
        if (env_1.env.DEPLOY_MODE === "DESKTOP") {
            const planLicence = process.env.LICENSE_PLAN === "PRO" ? "PRO" : "STANDARD";
            const company = await database_1.default.company.findFirst({ select: { id: true } });
            if (company) {
                await database_1.default.company.update({
                    where: { id: company.id },
                    data: { plan: planLicence, statutAbonnement: "ACTIF" },
                });
                console.log(`Licence synchronisée : plan ${planLicence}`);
            }
            // Si aucune company n'existe encore (première installation, avant
            // l'onboarding), rien à synchroniser — ça se fera au prochain
            // démarrage une fois la company créée.
        }
        const server = app_1.default.listen(env_1.env.PORT, () => {
            console.log(`Serveur Delice Pro demarre sur http://localhost:${env_1.env.PORT}`);
            console.log(`Environnement : ${env_1.env.NODE_ENV}`);
            console.log(`Frontend autorise : ${env_1.env.FRONTEND_URL}`);
        });
        const shutdown = async (signal) => {
            console.log(`Signal ${signal} recu. Arret propre en cours...`);
            server.close(async () => {
                await database_1.default.$disconnect();
                console.log("Connexion BDD fermee proprement");
                process.exit(0);
            });
            setTimeout(() => {
                console.error("Arret force apres timeout");
                process.exit(1);
            }, 10000);
        };
        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));
        process.on("unhandledRejection", (reason) => {
            console.error("Promesse rejetee non geree :", reason);
            shutdown("unhandledRejection");
        });
    }
    catch (error) {
        console.error("Impossible de demarrer le serveur :", error);
        await database_1.default.$disconnect();
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=server.js.map