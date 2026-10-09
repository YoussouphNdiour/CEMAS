# Lot 4b — Encadrement du passage à l'année suivante (design)

Date : 2026-10-09 · Statut : design validé en conversation, en attente de relecture de la spec
Prolonge : `2026-10-09-lot4-passage-annee-design.md`

## 1. Objectif

Faire en sorte que le passage à l'année suivante ne puisse être lancé **qu'au bon moment et dans de bonnes conditions**, et que le directeur soit **prévenu** quand il faut le préparer puis le lancer — chaque année, sans consigne à retenir.

### Critères de réussite
- Avant la fin de l'année active, le passage peut être **préparé** (classes suivantes, décisions par élève) mais **pas lancé** ; le serveur refuse aussi.
- À partir du lendemain de la date de fin (1er août pour une année finissant le 31 juillet), le lancement est possible si les contrôles passent.
- Le lancement est bloqué sans sauvegarde de moins de 24 h ; une sauvegarde est faite automatiquement juste avant le passage et le passage n'a lieu que si elle a réussi.
- Le tableau de bord affiche un bandeau de préparation à partir du 15 juin, puis un bandeau « Il est temps » à partir de l'ouverture, jusqu'à ce que le passage soit fait.

### Hors périmètre (décidé)
- Emails et tâche planifiée (abandonnés) ; bouton d'email de test.

## 2. Fenêtre

Notations : année active `S` (`date_fin`), date du jour `J` (serveur, UTC = Dakar).

| État | Condition | Effet |
|---|---|---|
| `aucun` | `J` < 15 juin de l'année de `date_fin` | aucun bandeau ; assistant accessible (préparation) |
| `preparation` | 15 juin ≤ `J` ≤ `date_fin` | bandeau « Préparez » ; assistant : préparation seulement |
| `ouvert` | `J` > `date_fin` | bandeau « Il est temps » ; lancement possible |

- Date d'ouverture affichée : `date_fin + 1 jour` (ex. « 1er août 2027 »).
- Fonction pure `etatFenetrePassage(dateFin, aujourdhui)` → `{ etat, ouverture, debutPreparation }` (Vitest).
- Pour les tests, `PASSAGE_AUJOURDHUI=AAAA-MM-JJ` remplace la date du jour **uniquement hors production** (`NODE_ENV !== "production"`).

## 3. Préparation persistante

Les décisions par élève (Redouble / Quitte) doivent survivre entre juin et août.

### Table `passage_decisions` (migration 0008)
| Colonne | Type | Contrainte |
|---|---|---|
| `eleve_id` | uuid | PK, FK → `eleves.id` ON DELETE CASCADE |
| `annee_scolaire_id` | uuid | FK → `annees_scolaires.id` ON DELETE CASCADE, NOT NULL |
| `decision` | varchar(10) | NOT NULL, `redouble` ou `quitte` (« passe » = pas de ligne) |
| `updated_at` | timestamptz | default now() |

- `passage.enregistrerDecisions({ decisions })` : remplace les décisions de l'année active (supprime puis insère), dans une transaction.
- `passage.contexte` renvoie les décisions enregistrées ; l'assistant les précharge.
- Après un passage réussi, les décisions de l'année source sont supprimées (dans la transaction).

## 4. Contrôles avant passage (étape 5 de l'assistant)

L'assistant passe à 5 étapes : 1. Nouvelle année · 2. Classes · 3. Élèves (bouton « Enregistrer les décisions ») · 4. Vérification · **5. Contrôles et lancement**.

| Contrôle | Règle | Bloquant |
|---|---|---|
| Fenêtre | état `ouvert` | oui |
| Dernière sauvegarde | fichier `cemas-*.dump` le plus récent de `BACKUP_DIR`, âge < 24 h ; affichage date + taille ; bouton « Faire une sauvegarde maintenant » | oui |
| Impayés restants | total `finance.impayes` de l'année active, affiché | non (information) |
| Liste à cocher | « Classes suivantes vérifiées », « Redoublants et départs décidés », « Grille tarifaire de la nouvelle année revue » | oui (les 3) |

### Sauvegardes depuis l'application
- Le conteneur de l'application reçoit le client PostgreSQL (`postgresql16-client`) et le volume `cemas_backups` monté sur `/backups` ; variable `BACKUP_DIR=/backups`.
- `src/modules/academic/sauvegarde-service.ts` :
  - `derniereSauvegarde()` → `{ fichier, date, taille } | null` (plus récent `cemas-*.dump` ou `prepassage-*.dump`) ;
  - `sauvegarder(prefixe: "cemas" | "prepassage")` → `pg_dump -Fc` de `DATABASE_URL` vers `BACKUP_DIR/<prefixe>-AAAAMMJJ-HHMMSS.dump`, vérifié par `pg_restore -l`, fichier supprimé et erreur levée en cas d'échec.
  - `BACKUP_DIR` absent → `derniereSauvegarde()` renvoie `null` et `sauvegarder()` échoue avec « Sauvegardes non configurées » (le lancement est donc impossible).
- Les fichiers `prepassage-*` ne sont pas purgés par le service `backup` (motif `cemas-*` seulement).

### Exécution (`passage.executer`)
Entrée : `{ cible, decisions, confirmations: { classes: true, decisions: true, grille: true } }`.
Ordre côté serveur :
1. refus si la fenêtre n'est pas `ouvert` ;
2. refus si les 3 confirmations ne sont pas `true` ;
3. refus si aucune sauvegarde de moins de 24 h ;
4. sauvegarde `prepassage-…` (si échec : refus, rien n'est modifié) ;
5. transaction du lot 4 (inchangée) + suppression des décisions de l'année source ;
6. réponse enrichie du nom du fichier de sauvegarde avant passage.

Nouvelles procédures : `passage.controles` (query → fenêtre, dernière sauvegarde, total impayés), `passage.sauvegarder` (mutation → sauvegarde `cemas-…` immédiate), `passage.enregistrerDecisions` (mutation).

## 5. Bandeaux du tableau de bord

`dashboard.rappelPassage` (query) → `{ etat, ouverture, libelleCible, classesAConfigurer }`.

| État | Bandeau |
|---|---|
| `preparation` | « Fin d'année le 31 juillet : préparez le passage à 2027-2028 — N classes sans classe suivante, décisions à saisir » + lien « Préparer » |
| `ouvert` | « L'année 2026-2027 est terminée : passez à l'année 2027-2028 » + lien « Lancer le passage » (mise en avant) |
| `aucun` | rien |

Le bandeau disparaît après le passage (la nouvelle année active a une date de fin future).

## 6. Page Années

Le lien « Passer à l'année suivante » reste visible ; avant l'ouverture il s'intitule « Préparer le passage (ouverture le 1er août 2027) ».

## 7. Tests

- Vitest :
  - `etatFenetrePassage` : aucun (mai), preparation (15 juin, 31 juillet), ouvert (1er août), année finissant un autre jour.
  - choix de la dernière sauvegarde (fonction pure sur une liste de fichiers `{ nom, mtime, taille }`) : plus récent, préfixes acceptés, liste vide.
- e2e :
  - `13-classe-suivante` (non destructif) : enregistrer des décisions puis les retrouver dans `passage.contexte`.
  - `14-passage` (destructif, CI) avec `PASSAGE_AUJOURDHUI=2027-08-01` et `BACKUP_DIR` temporaire : étape 5 — lancement désactivé tant que la liste n'est pas cochée ; « Faire une sauvegarde maintenant » rend le contrôle vert ; passage réussi ; un fichier `prepassage-*.dump` existe.
  - nouveau test API : avec `PASSAGE_AUJOURDHUI` avant la fin d'année, `passage.executer` est refusé (« disponible à partir du … »).
- CI : `PASSAGE_AUJOURDHUI` et `BACKUP_DIR` dans le job e2e ; `pg_dump` du runner (client PostgreSQL 16) disponible.

## 8. Documentation
- `02_features.md`, `03_data_model.md` (`passage_decisions`), `04_api_spec.md`, `05_ui_spec.md`, `16_decisions.md` (D-020), `19_sauvegardes.md` (sauvegardes `prepassage-*`, volume monté dans l'application).

## 9. Déploiement
- `Dockerfile` (runner) : `apk add --no-cache postgresql16-client`.
- `docker-compose.yml`, service `app` : volume `cemas_backups:/backups`, `BACKUP_DIR: /backups`.
- Migration 0008 additive.
