# 08 - Intégrations

## Intégrations actuelles

### PostgreSQL 16

- **Rôle :** Base de données principale
- **Connexion :** Via variable d'environnement `DATABASE_URL`
- **Driver :** `postgres` (postgres.js)
- **ORM :** Drizzle ORM
- **Migrations :** `drizzle-kit generate` + `drizzle-kit migrate`
- **Studio :** `drizzle-kit studio` pour l'exploration visuelle

### Auth.js v5 (NextAuth)

- **Provider :** Credentials (email + mot de passe)
- **Session :** JWT (stateless)
- **Hash :** bcryptjs pour le hachage des mots de passe
- **Variables :** `AUTH_SECRET`, `AUTH_URL`

### Recharts 3.x

- **Usage :** Graphiques du tableau de bord uniquement
- **Types :** BarChart (paiements mensuels), PieChart (élèves par niveau)
- **Rendu :** Côté client (`"use client"`)

### Lucide React

- **Usage :** Icônes dans toute l'application
- **Icônes principales :** LayoutDashboard, BookOpen, Users, Banknote, Bus, Briefcase, Settings, Plus, etc.

## Intégrations prévues

| Intégration | Priorité | Description |
|------------|----------|-------------|
| Impression PDF | P1 | Export des bulletins de paie et reçus en PDF |
| Backup automatique | P1 | Sauvegarde programmée de la base PostgreSQL |
| SMS notifications | P2 | Notification des parents pour les impayés |

## Variables d'environnement

| Variable | Description | Obligatoire |
|----------|-------------|-------------|
| `DATABASE_URL` | URL de connexion PostgreSQL | Oui |
| `AUTH_SECRET` | Secret pour le chiffrement des sessions JWT | Oui |
| `AUTH_URL` | URL de base de l'application | Oui |
| `NEXTAUTH_URL` | Alias pour AUTH_URL (compatibilité) | Non |

## Scripts npm

| Script | Commande | Description |
|--------|----------|-------------|
| `dev` | `next dev` | Serveur de développement |
| `build` | `next build` | Build de production |
| `start` | `next start` | Serveur de production |
| `db:generate` | `drizzle-kit generate` | Génère les migrations SQL |
| `db:migrate` | `drizzle-kit migrate` | Applique les migrations |
| `db:seed` | `tsx src/shared/lib/seed.ts` | Seed de la base de données |
| `db:studio` | `drizzle-kit studio` | Interface visuelle Drizzle |
| `lint` | `biome check src/` | Vérification du code |
| `format` | `biome format --write src/` | Formatage du code |

## Configuration Drizzle

```typescript
// drizzle.config.ts
defineConfig({
  schema: "./src/modules/*/schema.ts",  // Auto-découverte des schémas
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

---

> Ce fichier est la source de vérité pour les intégrations du projet CEMAS.
