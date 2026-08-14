"use strict";
// ═══════════════════════════════════════════════════════════════
// src/config/database.ts
// Client Prisma — connexion à la base de données
//
// Pourquoi un singleton ?
// En développement, Node recharge les modules à chaque modification
// de fichier (hot-reload). Sans singleton, on créerait une nouvelle
// connexion à chaque rechargement → trop de connexions.
// Le singleton garantit qu'on utilise toujours la même instance.
// ═══════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./env");
// En mode SAAS et DESKTOP_RESEAU, on utilise le client Prisma "standard"
// (@prisma/client), généré depuis schema.prisma pour PostgreSQL — les deux
// se connectent à une vraie base PostgreSQL (juste hébergée différemment :
// cloud pour SAAS, serveur d'entreprise pour DESKTOP_RESEAU).
// En mode DESKTOP (SQLite local), on utilise le client généré séparément
// depuis schema.electron.prisma (voir scripts/build-electron-schema.js et
// `npm run prisma:generate:electron`). Les deux clients coexistent dans
// node_modules sans jamais s'écraser l'un l'autre.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = env_1.env.DEPLOY_MODE === "DESKTOP"
    ? require("../../node_modules/.prisma/client-electron")
    : require("@prisma/client");
// Créer le client Prisma avec des options de logging selon l'environnement
const prisma = global.prisma ||
    new PrismaClient({
        log: env_1.env.NODE_ENV === "development"
            ? ["query", "error", "warn"] // En dev : afficher toutes les requêtes SQL
            : ["error"], // En prod : seulement les erreurs
    });
// En développement, stocker l'instance dans le scope global
// pour éviter de créer de nouvelles connexions à chaque hot-reload
if (env_1.env.NODE_ENV !== "production") {
    global.prisma = prisma;
}
exports.default = prisma;
//# sourceMappingURL=database.js.map