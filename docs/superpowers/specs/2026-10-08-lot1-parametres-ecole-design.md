# Lot 1 — Paramètres de l'école configurables (design)

Date : 2026-10-08 · Statut : design validé en conversation, en attente de relecture de la spec
Source : `docs/17_prompt_ameliorations_web.md` § 1

## 1. Objectif

L'application web devient le produit **Gestion Ecole**. L'identité de l'établissement (aujourd'hui « CEMAS », codée en dur à 11 endroits) devient une donnée éditable depuis la page Paramètres.

### Critères de réussite
- Le titre du navigateur et la page de connexion affichent « Gestion Ecole ».
- La sidebar, l'en-tête d'impression, le reçu PDF et l'expéditeur des emails affichent les valeurs saisies dans Paramètres.
- Les nouveaux matricules élèves, numéros de reçu et matricules employés utilisent les préfixes configurés ; les identifiants existants ne changent pas.
- Après déploiement, la production affiche exactement les mêmes informations qu'aujourd'hui (valeurs initiales = valeurs CEMAS actuelles), et la numérotation continue sans trou ni doublon.

### Hors périmètre
- Logo (décision : reporté).
- Multi-établissement.

## 2. État de la production (constaté le 2026-10-08, lecture seule)

- 5 migrations appliquées sur 5 (`0000` → `0004_cleanup_reset`). Les migrations et le seed sont exécutés au démarrage du conteneur par `scripts/entrypoint.sh`, **erreurs masquées** (`2>/dev/null || echo …`).
- 105 élèves, matricules `CEMAS-2026-0001` → `CEMAS-2026-0105`.
- 161 paiements, reçus `REC-2026-0001` → `REC-2026-0161`.
- 0 employé.
- 1 utilisateur `admin@cemas.online` (nom « Administrateur CEMAS » — non modifié par ce lot).

## 3. Données

### Table `parametres_ecole` (une seule ligne)

Nouveau module `src/modules/settings/` (`schema.ts`, `validation.ts`, `service.ts`, `router.ts`), sur le modèle des modules existants.

| Colonne | Type | Contrainte | Valeur initiale |
|---|---|---|---|
| `id` | integer | PK, default 1, `CHECK (id = 1)` | 1 |
| `nom` | varchar(150) | not null | Complexe Educatif Mame Anta Sidibe |
| `sigle` | varchar(30) | not null | CEMAS |
| `adresse` | varchar(255) | nullable | Quartier Zac Ba, Thies, Senegal |
| `telephone1` | varchar(30) | nullable | 77 300 08 31 |
| `telephone2` | varchar(30) | nullable | — |
| `email` | varchar(150) | nullable | admin@cemas.online |
| `contacts_entete` | text | nullable | DG: M. Ndiour 77 300 08 31 \| Dir. Elem.: M. Bass 77 521 37 19 \| Dir. Presc.: Mme Cissokho 77 649 03 75 |
| `prefixe_matricule` | varchar(10) | not null | CEMAS |
| `prefixe_recu` | varchar(10) | not null | REC |
| `prefixe_employe` | varchar(10) | not null | EMP |
| `updated_at` | timestamptz | default now() | — |

`contacts_entete` est une ligne de texte libre imprimée sous l'adresse dans les en-têtes (reprend la ligne de contacts aujourd'hui en dur dans le reçu).

### Migration
- `0005_*` générée par `drizzle-kit generate`, puis complétée à la main par :
  - la contrainte `CHECK (id = 1)` ;
  - `INSERT … VALUES (1, …valeurs initiales…) ON CONFLICT (id) DO NOTHING`.
- La production obtient donc la ligne CEMAS même si le seed échoue.
- Migration purement additive : aucune table existante n'est modifiée.

### Seed
- `seed.ts` insère la ligne avec les mêmes valeurs si elle est absente (`onConflictDoNothing`).
- Le `Dockerfile` copie explicitement les `schema.ts` dont le seed dépend : ajouter `src/modules/settings/schema.ts`.

## 4. API tRPC — `settings`

Enregistré dans `src/shared/lib/root-router.ts`.

| Procédure | Accès | Entrée | Sortie |
|---|---|---|---|
| `settings.get` | protected | — | ligne complète |
| `settings.public` | public | — | `{ nom, sigle }` |
| `settings.update` | protected | `updateParametresSchema` | ligne mise à jour |

- Une fonction serveur `getParametres(db)` dans `src/modules/settings/service.ts` lit la ligne et **renvoie les valeurs par défaut CEMAS si elle est absente**. Elle est utilisée par les procédures et par les générateurs d'identifiants. Cela protège l'application si la migration n'a pas été appliquée (erreurs masquées par l'entrypoint).
- `updateParametresSchema` (zod) :
  - `nom` 2–150, `sigle` 1–30 caractères, obligatoires (après trim) ;
  - `adresse`, `telephone1`, `telephone2`, `contacts_entete` optionnels ; chaîne vide → `null` ;
  - `email` optionnel, format email si renseigné ;
  - préfixes : `/^[A-Z0-9]{2,10}$/` (majuscules et chiffres, sans tiret). La longueur max garantit `PREFIXE-AAAA-NNNN` ≤ 20 caractères, taille des colonnes `matricule` et `numero_recu`.

## 5. Génération des identifiants

Principe commun : la séquence suivante est calculée **uniquement sur les identifiants qui commencent par le préfixe courant**, et le numéro est extrait par regex (plus de `split("-")`).

| Identifiant | Format | Filtre de séquence | Code concerné |
|---|---|---|---|
| Matricule élève | `{prefixe_matricule}-{année}-{NNNN}` | `^{prefixe}-{année}-(\d+)$` | `students/router.ts` `create` |
| Numéro de reçu | `{prefixe_recu}-{année}-{NNNN}` | `^{prefixe}-{année}-(\d+)$` | `finance/router.ts` `paiements.create` |
| Matricule employé | `{prefixe_employe}-{NNN}` | `^{prefixe}-(\d+)$` | `payroll/router.ts` `create` |

- `generateMatricule(prefix, year, seq)` existe déjà ; `generateRecuNumber` et `generateEmployeMatricule` reçoivent un paramètre `prefix`.
- Le calcul se fait par `MAX` de la partie numérique castée en entier (SQL `substring … ::int`), pas par `MAX` de chaîne.
- Changement de comportement assumé pour les reçus : la séquence est désormais **par préfixe et par année** (aujourd'hui elle est globale). Production : prochain reçu `REC-2026-0162`, prochain matricule `CEMAS-2026-0106`.
- Changer un préfixe redémarre la séquence à 1 pour ce nouveau préfixe ; l'unicité reste garantie car le préfixe diffère.

## 6. Interface

| Emplacement | Avant | Après |
|---|---|---|
| `src/app/layout.tsx` metadata | « CEMAS — Gestion Scolaire » | titre « Gestion Ecole », description « Gestion scolaire » (fixes) |
| `(auth)/login/page.tsx` | « CEMAS » | « Gestion Ecole » en titre ; `nom` de l'école dessous (via `settings.public`, rien si non chargé) |
| `shared/ui/sidebar.tsx` | « CEMAS » / « Gestion Scolaire » | `sigle` / « Gestion Ecole » |
| `shared/ui/print-layout.tsx` | texte en dur | `sigle — nom`, puis adresse et téléphones si renseignés |
| `shared/lib/generate-recu-pdf.ts` | en-tête en dur | reçoit `ecole: { nom, sigle, adresse, telephone1, telephone2, email, contactsEntete }` en argument ; lignes vides omises |
| `finances/paiements/page.tsx` | — | passe `settings.get` à `generateRecuPdf` |
| `shared/lib/mail.ts` | `"CEMAS"` | nom d'expéditeur = `sigle` lu via `getParametres` |
| `(dashboard)/parametres/page.tsx` | lecture seule, « CEMAS » | carte « Établissement » éditable (formulaire, bouton Enregistrer, message de succès/erreur) ; carte « École » = `sigle` ; « À propos » : Application « Gestion Ecole », Établissement = `nom` |

- Côté client, toutes les lectures passent par `trpc.settings.get.useQuery()` (cache React Query partagé). Après `update`, invalidation de `settings.get` et `settings.public`.
- `seed.ts` : le nom de l'admin créé devient « Administrateur » (n'affecte pas la production, l'utilisateur existe déjà).

## 7. Tests et vérification

- `e2e/07-parametres.spec.ts` :
  1. ouvrir Paramètres, modifier `sigle` et `prefixe_matricule`, enregistrer ;
  2. vérifier le nouveau sigle dans la sidebar ;
  3. inscrire un élève, vérifier que son matricule commence par le nouveau préfixe ;
  4. remettre les valeurs d'origine (en `afterAll`, même en cas d'échec).
- Vérifier que le titre de la page de connexion est « Gestion Ecole ».
- Validation zod : préfixe avec tiret ou minuscules refusé.
- `npm run lint`, `npm run build` propres ; migration appliquée en local sur une base contenant des identifiants au format production.

## 8. Documentation
- `docs/02_features.md` : paramètres éditables.
- `docs/03_data_model.md` : table `parametres_ecole`.
- `docs/04_api_spec.md` : routeur `settings`.
- `docs/16_decisions.md` : nom de produit « Gestion Ecole » ; pas de logo pour l'instant ; séquences par préfixe/année ; fallback valeurs par défaut.

## 9. Déploiement
- Le déploiement applique la migration au démarrage. Après déploiement, vérifier en lecture seule : `select * from parametres_ecole;` renvoie la ligne CEMAS ; un paiement test (ou le suivant) obtient `REC-2026-0162`.
