// ═══════════════════════════════════════════════════════════════
// backend/scripts/build-electron-schema.js
//
// Génère prisma/schema.electron.prisma à partir de prisma/schema.prisma.
// Un seul fichier de modèles à maintenir (schema.prisma) — celui-ci
// est régénéré automatiquement, jamais édité à la main.
//
// Différences entre les deux :
//   schema.prisma          → datasource postgresql (SaaS web)
//   schema.electron.prisma → datasource sqlite (app desktop locale)
//
// SQLite ne supporte NI les enums Prisma, NI le type Json, NI les
// attributs natifs comme @db.Text — ce script convertit donc
// automatiquement :
//   - chaque `enum X { ... }` → supprimé, et chaque champ de type X
//     devient `String` (les valeurs par défaut `@default(VALEUR)`
//     sont requotées en `@default("VALEUR")`)
//   - chaque champ `Json` → `String` (stocké en JSON sérialisé,
//     voir la sérialisation manuelle nécessaire côté code — les
//     endroits concernés sont commentés dans le backend)
//   - `@db.Text` → supprimé (non supporté, TEXT est le comportement
//     par défaut de SQLite de toute façon)
// ═══════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");

const SOURCE = path.join(__dirname, "..", "prisma", "schema.prisma");
const DEST = path.join(__dirname, "..", "prisma", "schema.electron.prisma");

let contenu = fs.readFileSync(SOURCE, "utf-8");

const datasourcePostgres = /datasource db \{[^}]*\}/s;
const generatorBlock = /generator client \{[^}]*\}/s;

if (!datasourcePostgres.test(contenu) || !generatorBlock.test(contenu)) {
  console.error("❌ Bloc datasource ou generator introuvable dans schema.prisma — abandon.");
  process.exit(1);
}

// ── 1. Repérer tous les enums déclarés, et retenir leurs valeurs ──────────
const enumRegex = /enum\s+(\w+)\s*\{([^}]*)\}/g;
const enums = {}; // { NomEnum: [VALEUR1, VALEUR2, ...] }
let m;
while ((m = enumRegex.exec(contenu)) !== null) {
  const nom = m[1];
  const valeurs = m[2]
    .split("\n")
    .map(l => l.replace(/\/\/.*$/, "").trim())
    .filter(Boolean);
  enums[nom] = valeurs;
}
const nomsEnums = Object.keys(enums);
console.log(`→ ${nomsEnums.length} enum(s) détecté(s) : ${nomsEnums.join(", ") || "(aucun)"}`);

// ── 2. Supprimer les blocs enum (SQLite ne les supporte pas) ──────────────
contenu = contenu.replace(enumRegex, "").replace(/\n{3,}/g, "\n\n");

// ── 3. Remplacer chaque champ typé par un enum, par String ────────────────
for (const nomEnum of nomsEnums) {
  const champRegex = new RegExp(
    `(\\w+\\s+)${nomEnum}(\\?|\\[\\])?(\\s*)(@default\\((\\w+)\\))?`,
    "g"
  );
  contenu = contenu.replace(champRegex, (match, nomChamp, suffixe, espaces, defautComplet, valeurDefaut) => {
    const type = `String${suffixe ?? ""}`;
    if (valeurDefaut) {
      return `${nomChamp}${type}${espaces}@default("${valeurDefaut}")`;
    }
    // BUG CORRIGÉ : il faut garder "espaces" ici aussi (contient souvent
    // le retour à la ligne + l'indentation du champ suivant) — sinon le
    // champ suivant se retrouve collé directement après "String".
    return `${nomChamp}${type}${espaces}`;
  });
}

// ── 4. Json → String (sérialisation manuelle requise côté code) ───────────
contenu = contenu.replace(/(\w+\s+)Json(\?|\[\])?/g, (match, nomChamp, suffixe) => {
  return `${nomChamp}String${suffixe ?? ""}`;
});

// ── 5. Retirer les attributs natifs non supportés (@db.Text, etc.) ────────
contenu = contenu.replace(/\s*@db\.\w+/g, "");

// ── 6. Datasource et generator ─────────────────────────────────────────────
const datasourceSqlite = `datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}`;

const generatorElectron = `generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client-electron"
}`;

const entete = `// ═══════════════════════════════════════════════════════════════
// prisma/schema.electron.prisma
// GÉNÉRÉ AUTOMATIQUEMENT depuis schema.prisma — NE PAS ÉDITER À LA MAIN.
// Pour modifier les modèles : édite schema.prisma puis relance
//   npm run schema:electron
//
// Différences automatiques par rapport à schema.prisma (SQLite
// n'accepte ni enum, ni Json, ni @db.Text) :
//   - les enums sont convertis en String (valeurs identiques,
//     simplement plus de contrainte au niveau de la base — la
//     validation Zod côté API reste la seule garde-fou, comme avant)
//   - les champs Json sont convertis en String (JSON sérialisé à la
//     main — voir les commentaires "SQLITE" dans le code backend)
// ═══════════════════════════════════════════════════════════════

`;

const resultat =
  entete +
  contenu
    .replace(datasourcePostgres, datasourceSqlite)
    .replace(generatorBlock, generatorElectron);

fs.writeFileSync(DEST, resultat, "utf-8");
console.log("✅ prisma/schema.electron.prisma régénéré depuis schema.prisma");
console.log(`✅ ${nomsEnums.length} enum(s) converti(s) en String, champs Json convertis en String`);

