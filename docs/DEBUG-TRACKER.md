# DEBUG-TRACKER

## Format

| Date | Module | Symptôme | Cause | Résolution | Commit |
|------|--------|----------|-------|------------|--------|
| 2026-09-30 | Finance | Pages dépenses/recettes : prop `actions` n'existe pas sur DataTable | DataTable n'expose pas de prop `actions` | Colonne avec `render` pour le bouton supprimer | f3bf847 |
| 2026-09-30 | Dashboard | TS2322 sur Recharts Tooltip formatter | Type de formatter incompatible | Cast `(value) => [formatCFA(Number(value)), "Montant"]` | f3bf847 |
| 2026-09-30 | Paramètres | Imports inutilisés | Formulaire supprimé, imports conservés | Suppression | f3bf847 |
| 2026-09-30 | Payroll | Pages dupliquées `/paie/` et `/payroll/` | Deux agents parallèles | Conservation de `/payroll/` | f3bf847 |
| 2026-10-09 | Élèves | Inscription en erreur 500 si la table `parametres_ecole` manque | La lecture des paramètres échouait dans la transaction, qui restait avortée | Paramètres lus avant la transaction ; repli seulement sur « table absente » | 4d785a0 |
| 2026-10-09 | Outils | `pnpm lint` en erreur de configuration | `biome.json` au format 2.0, CLI 2.5 | `biome migrate`, règles historiques en avertissement | 74b3b5e |
| 2026-10-09 | Tests | Tests de création d'employé sans effet | Champ de recherche de la page compté comme premier `input[type=text]` | Champs ciblés dans la modale (`role="dialog"`) | 3450e8c |
| 2026-10-09 | CI | Tests 02/09 instables sur `main` | `classes.list` sans ordre : la classe créée passait en page 2 | Tri niveau puis nom ; tests via la recherche | PR #7 |
| 2026-10-09 | CI | Tests 10 et 11 jamais exécutés en CI | Motif `e2e/0[1-9]` | Motif `e2e/(0[1-9]\|[1-9][0-9])-` | PR #7 |
| 2026-10-09 | Impayés | Un élève pouvait apparaître deux fois | Jointure sur plusieurs contacts principaux | Dédoublonnage dans le calcul | 27acc4b |
| 2026-10-09 | Grille | Saisies non enregistrées perdues au rechargement | `useEffect` réinitialisant toutes les cellules | État des seules modifications superposé aux valeurs enregistrées | 27acc4b |
| 2026-10-09 | Passage | Deux passages simultanés créaient deux années cibles | Lecture de l'année active sans verrou | `SELECT … FOR UPDATE` | PR #10 |

---

## Bugs ouverts

Aucun bug ouvert. Points reportés et limitations : `10_current_issues.md`.

---

> Ce fichier suit les bugs rencontrés et résolus pendant le développement.
