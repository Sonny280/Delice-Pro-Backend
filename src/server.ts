// ═══════════════════════════════════════════════════════════════
// src/server.ts
// Point d'entrée du serveur
// ═══════════════════════════════════════════════════════════════

import app from "./app";
import { env } from "./config/env";
import prisma from "./config/database";

// Route ping déplacée dans app.ts (voir ce fichier) — elle devait être
// définie AVANT le gestionnaire 404 final, qui est déjà en place au
// moment où ce fichier s'exécute.

async function startServer() {
  try {
    await prisma.$connect();
    console.log("Connexion a la base de donnees etablie");

    // En mode DESKTOP, le plan (STANDARD/PRO) vient de la licence vérifiée
    // par Electron (main.js), pas d'un abonnement en ligne. On synchronise
    // Company.plan à CHAQUE démarrage : si le client active une nouvelle
    // licence (upgrade Standard → Pro), un simple redémarrage de l'app
    // suffit à débloquer les fonctionnalités correspondantes.
    // Ce champ n'est jamais modifiable depuis l'interface elle-même
    // (aucune route ne l'expose) — seule cette synchronisation le change.
    if (env.DEPLOY_MODE === "DESKTOP") {
      const planLicence = process.env.LICENSE_PLAN === "PRO" ? "PRO" : "STANDARD";
      const company = await prisma.company.findFirst({ select: { id: true } });
      if (company) {
        await prisma.company.update({
          where: { id: company.id },
          data: { plan: planLicence, statutAbonnement: "ACTIF" },
        });
        console.log(`Licence synchronisée : plan ${planLicence}`);
      }
      // Si aucune company n'existe encore (première installation, avant
      // l'onboarding), rien à synchroniser — ça se fera au prochain
      // démarrage une fois la company créée.
    }

    const server = app.listen(env.PORT, () => {
      console.log(`Serveur Delice Pro demarre sur http://localhost:${env.PORT}`);
      console.log(`Environnement : ${env.NODE_ENV}`);
      console.log(`Frontend autorise : ${env.FRONTEND_URL}`);
    });

    const shutdown = async (signal: string) => {
      console.log(`Signal ${signal} recu. Arret propre en cours...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log("Connexion BDD fermee proprement");
        process.exit(0);
      });
      setTimeout(() => {
        console.error("Arret force apres timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT",  () => shutdown("SIGINT"));

    process.on("unhandledRejection", (reason: unknown) => {
      console.error("Promesse rejetee non geree :", reason);
      shutdown("unhandledRejection");
    });
  } catch (error) {
    console.error("Impossible de demarrer le serveur :", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
