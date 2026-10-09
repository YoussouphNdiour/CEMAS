# 15 - Orchestration des modules

## Flux de données entre modules

```
                    ┌─────────────┐
                    │  Dashboard  │
                    │  (lecture)  │
                    └──────┬──────┘
                           │ requête agrégée
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │ Students │    │ Finance  │    │ Payroll  │
   └────┬─────┘    └────┬─────┘    └──────────┘
        │               │
        ▼               ▼
   ┌──────────┐    ┌──────────┐
   │ Academic │    │ Academic │
   └──────────┘    └──────────┘
```

## Dépendances inter-modules

### Module Academic (base, pas de dépendance)
- Fournit : `anneesScolaires`, `niveaux`, `classes`, `matieres`
- Utilisé par : Students, Finance, Transport, Dashboard

### Module Students → Academic
- `eleves.classeId` → `classes.id`
- `eleves.anneeScolaireId` → `anneesScolaires.id`
- `inscriptions.classeId` → `classes.id`
- `inscriptions.anneeScolaireId` → `anneesScolaires.id`

### Module Finance → Academic, Students
- `paiements.eleveId` → `eleves.id`
- `paiements.anneeScolaireId` → `anneesScolaires.id`
- `grilleFrais.classeId` → `classes.id`
- `grilleFrais.anneeScolaireId` → `anneesScolaires.id`
- `finance.suivi.byClasse` : lecture des élèves par classe

### Module Payroll (indépendant)
- Aucune dépendance sur les autres modules
- Tables : `employes`, `bulletins_paie`

### Module Transport → Academic, Students
- `affectationsTransport.eleveId` → `eleves.id`
- `affectationsTransport.anneeScolaireId` → `anneesScolaires.id`

### Module Dashboard → tous les modules
- Lecture seule, agrège des données de :
  - Students : comptage élèves
  - Academic : comptage classes
  - Finance : somme paiements, somme dépenses
  - Payroll : comptage employés, masse salariale

## Routeur racine

```typescript
// src/shared/lib/root-router.ts
export const appRouter = createTRPCRouter({
  academic: academicRouter,
  students: studentsRouter,
  payroll: payrollRouter,
  finance: financeRouter,
  transport: transportRouter,
  dashboard: dashboardRouter,
});
```

## Ordre de seed / migration

1. **Auth** : table `users` (utilisateur par défaut)
2. **Academic** : `niveaux` (données statiques : Crèche, Préscolaire, Élémentaire)
3. **Academic** : `annees_scolaires` (première année scolaire)
4. **Finance** : `types_frais`, `categories_depenses`, `categories_recettes`
5. Les autres tables se remplissent via l'interface utilisateur

## Flux utilisateur typique

### Début d'année scolaire
```
1. Créer/activer l'année scolaire
2. Créer les classes pour cette année
3. Configurer les matières par niveau
4. Définir la grille tarifaire (classe × type frais)
5. Inscrire les élèves (+ parents)
6. Affecter les élèves au transport
```

### Chaque mois
```
1. Enregistrer les paiements des élèves
2. Enregistrer les dépenses
3. Enregistrer les autres recettes
4. Générer les bulletins de paie
5. Ajuster primes/retenues si nécessaire
6. Marquer les bulletins comme payés
7. Consulter le tableau de bord et le bilan
```

---

> Ce fichier est la source de vérité pour l'orchestration des modules du projet CEMAS.
