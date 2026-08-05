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

import { env } from "./env";

// CORRECTIF : "import type" est effacé à la compilation — il ne force
// PAS d'utiliser le client @prisma/client au runtime (ça reste le
// require() dynamique ci-dessous qui décide), mais il redonne à
// TypeScript la connaissance complète du type PrismaClient. Sans ça,
// le "require()" dynamique rendait tout le client (et donc chaque
// .map/.reduce/.filter sur des données Prisma dans toute l'app)
// implicitement "any" — c'est ce qui causait les ~70 erreurs de
// build qu'on avait déjà vues et corrigées une première fois.
import type { PrismaClient as PrismaClientType } from "@prisma/client";

// En mode SAAS et DESKTOP_RESEAU, on utilise le client Prisma "standard"
// (@prisma/client), généré depuis schema.prisma pour PostgreSQL — les deux
// se connectent à une vraie base PostgreSQL (juste hébergée différemment :
// cloud pour SAAS, serveur d'entreprise pour DESKTOP_RESEAU).
// En mode DESKTOP (SQLite local), on utilise le client généré séparément
// depuis schema.electron.prisma (voir scripts/build-electron-schema.js et
// `npm run prisma:generate:electron`). Les deux clients coexistent dans
// node_modules sans jamais s'écraser l'un l'autre.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } =
  env.DEPLOY_MODE === "DESKTOP"
    ? require("../../node_modules/.prisma/client-electron")
    : require("@prisma/client");

// Déclaration TypeScript pour stocker le client dans le scope global
// (nécessaire pour éviter les doublons en mode développement).
// Typé avec PrismaClientType (l'import de type ci-dessus), pas avec le
// PrismaClient dynamique — c'est ça qui restaure l'autocomplétion et
// la vérification de types partout dans l'app.
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClientType | undefined;
}

// Créer le client Prisma avec des options de logging selon l'environnement
const prisma: PrismaClientType =
  global.prisma ||
  (new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? ["query", "error", "warn"] // En dev : afficher toutes les requêtes SQL
        : ["error"], // En prod : seulement les erreurs
  }) as PrismaClientType);

// En développement, stocker l'instance dans le scope global
// pour éviter de créer de nouvelles connexions à chaque hot-reload
if (env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;