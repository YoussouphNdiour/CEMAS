# Lot 2 — Impayés et relances (design)

Date : 2026-10-09 · Statut : design validé en conversation, en attente de relecture de la spec
Source : `docs/17_prompt_ameliorations_web.md` § 2

## 1. Objectif

Savoir à tout moment qui doit combien, et pouvoir relancer les parents par lettre.

### Critères de réussite
- Le directeur saisit la grille tarifaire (montant par classe et par frais obligatoire) depuis l'application.
- La page Impayés liste les élèves actifs qui doivent de l'argent, avec le reste en FCFA, les mois impayés et le téléphone du contact principal, filtrable par classe/niveau, total en pied.
- Une lettre de relance PDF est générée pour un élève ou pour une sélection (un PDF, une page par élève).
- Le tableau de bord affiche le total des impayés.
- Aucun « faux impayé » pour un élève qui a payé un mois avec une remise.

### Hors périmètre
- Remises par élève, échéanciers, envoi des relances par SMS/email.
- Frais facultatifs (Tenue, Fourniture, Transport) : jamais dus.

## 2. Constats en production (2026-10-09, lecture seule)

- Types de frais : Inscription (obligatoire, unique, défaut 50 000), Scolarité (obligatoire, mensuel, défaut 25 000), Tenue / Fourniture (facultatifs, uniques), Transport (facultatif, mensuel).
- Montants réellement payés différents des défauts et variables selon le niveau : Inscription 40 000 à 80 000, Scolarité 20 000 ou 24 000.
- `grille_frais` vide, et aucun écran ne permet de la remplir (API `finance.grilleFrais.list/upsert` existante, non utilisée par l'UI).
- Des parents paient d'avance (Scolarité de janvier à mai payée en octobre).
- 150 élèves, dont environ 50 sans aucun paiement.

## 3. Règles de calcul

Notations : année scolaire active `A` (`date_debut`, `date_fin`), date du jour `J`.

1. **Élèves concernés** : statut `actif` et classe appartenant à `A` (`classes.annee_scolaire_id = A`).
2. **Frais concernés** : types `obligatoire = true`.
3. **Montant de référence** d'un élève pour un frais : `grille_frais.montant_mensuel` (classe de l'élève, frais, `A`) ; à défaut `types_frais.montant_defaut`, et la classe est signalée « montant par défaut ».
4. **Mois dus** : chaque mois calendaire du mois de `date_debut` jusqu'au mois de `min(J, date_fin)` inclus. Aucun si `J` est avant `date_debut`.
5. **Frais mensuel** : un mois dû est **soldé** s'il existe un paiement (élève, frais, `A`, mois), **quel que soit son montant** (remises, fratries). Sinon il est impayé.
6. **Frais unique** (`mensuel = false`, ex. Inscription) : dû une fois dès l'inscription (indépendamment des mois dus), soldé par n'importe quel paiement de ce frais pour `A`.
7. Par élève :
   - **Dû** = Σ frais mensuels (montant × nombre de mois dus) + Σ frais uniques (montant) ;
   - **Payé** = somme réelle des paiements de l'élève sur les frais obligatoires pour `A` (avances comprises) ;
   - **Reste** = Σ frais mensuels (montant × mois impayés) + Σ frais uniques non soldés (montant) ;
   - **Mois impayés** : liste `{ frais, mois }` (mois `null` pour un frais unique).
   - Dû − Payé peut différer de Reste (remises, avances) : la page l'explique.
8. Seuls les élèves avec **Reste > 0** apparaissent dans la liste des impayés.

## 4. Données

Aucune nouvelle table ni migration. `grille_frais.montant_mensuel` contient, pour un frais unique, le montant unique (nom de colonne historique ; documenté).

## 5. Serveur

### Fonction pure `src/modules/finance/impayes.ts`
```ts
calculerImpayes(params: {
  dateDebut: string; dateFin: string; aujourdhui: string;           // YYYY-MM-DD
  eleves: { id, matricule, prenom, nom, classeId, classeNom, niveauId, telephone: string | null }[];
  frais: { id, nom, montantDefaut, mensuel }[];                     // obligatoires
  grille: { classeId, typeFraisId, montant }[];
  paiements: { eleveId, typeFraisId, mois, montant }[];             // année A, frais obligatoires
}): {
  lignes: LigneImpaye[];   // reste > 0, triées par reste décroissant puis nom
  totalDu, totalPaye, totalReste: number;
  classesMontantDefaut: { classeId, classeNom, frais: string[] }[];
}
```
Testée par Vitest.

### Service `getImpayes(db, anneeScolaireId, filtres?)` (`src/modules/finance/impayes-service.ts`)
Charge les données (5 requêtes simples), appelle `calculerImpayes` avec la date du jour du serveur. Réutilisé par la procédure et par le tableau de bord.

### Procédures
| Procédure | Entrée | Sortie |
|---|---|---|
| `finance.impayes.list` | `{ anneeScolaireId, classeId?, niveauId? }` | résultat de `calculerImpayes` (filtré) |
| `finance.grilleFrais.upsertMany` | `{ anneeScolaireId, cellules: { classeId, typeFraisId, montant }[] }` (montant entier ≥ 0, 1 à 200 cellules) | nombre de cellules enregistrées ; transaction |
| `dashboard.stats` | inchangée | + `totalImpayes` |

`finance.grilleFrais.list` existant est réutilisé.

## 6. Interface

### `/finances/grille` — Grille tarifaire
- Tableau : lignes = classes de l'année active groupées par niveau (ordre du niveau puis nom) ; colonnes = frais obligatoires (libellé + « par mois » ou « une fois »).
- Cellule : champ numérique ; vide → placeholder = montant par défaut, badge « à renseigner ».
- Bouton « Enregistrer » (enregistre toutes les cellules modifiées via `upsertMany`), message de succès.
- Action de ligne « Appliquer au niveau » : recopie les montants saisis de la ligne sur les autres classes du même niveau (dans le formulaire ; enregistrés au clic sur « Enregistrer »).
- Lien sidebar : Finances → « Grille tarifaire ».

### `/finances/impayes` — Impayés
- Filtres niveau / classe. Tableau : case à cocher, matricule, élève, classe, dû, payé, reste, mois impayés (ex. « Scolarité : Nov, Déc · Inscription »), téléphone. Tri par reste décroissant. Pied : totaux dû / payé / reste et nombre d'élèves.
- Bandeau si `classesMontantDefaut` non vide : « N classes utilisent le montant par défaut — compléter la grille » (lien).
- Note : « Un mois pour lequel un paiement est enregistré est considéré comme soldé. »
- Bouton « Lettre » par ligne ; bouton « Lettres de relance (N) » pour la sélection (désactivé si N = 0).
- Lien sidebar : Finances → « Impayés ».

### Lettre de relance PDF — `src/shared/lib/generate-relance-pdf.ts`
- A4 portrait, jsPDF, généré côté client.
- En-tête école via `dessinerEnTeteEcole(doc, ecole, { largeur })` extrait de `generate-recu-pdf.ts` (réutilisé par le reçu et, au lot 3, la fiche de paie).
- Contenu : lieu/date, « À l'attention de » contact principal, élève (nom, classe, matricule), texte de relance, tableau (frais, période, montant), total restant, formule de politesse, signature « La Direction ».
- Lot : un document, une page par élève sélectionné ; nom de fichier `relances-AAAA-MM-JJ.pdf` (ou `relance-<matricule>.pdf` pour un élève).

### Tableau de bord
- Nouvelle carte « Impayés » (`formatCFA(totalImpayes)`), lien vers `/finances/impayes`.

## 7. Tests

- Vitest `impayes.test.ts` :
  - mois dus d'octobre au mois courant ; aucun avant le début ; plafonné à `date_fin` ;
  - frais mensuel : mois payé (même partiellement) = soldé ;
  - avance (mois futur payé) : ne réduit pas le reste, compte dans Payé ;
  - frais unique : dû une fois, soldé par un paiement quel que soit le mois ;
  - classe sans grille → montant par défaut + signalement ; avec grille → montant de la grille ;
  - élève à jour exclu ; tri par reste décroissant ; totaux.
- e2e `11-impayes` : saisir dans la grille Scolarité/Inscription pour une classe neuve, inscrire un élève sans paiement → visible dans Impayés avec le reste attendu ; payer l'inscription → reste diminue ; lettre téléchargée (événement download, PDF non vide) ; carte « Impayés » du tableau de bord visible.

## 8. Documentation
- `02_features.md` : Grille tarifaire, Impayés, Relances, KPI.
- `04_api_spec.md` : `finance.impayes.list`, `finance.grilleFrais.upsertMany`, `dashboard.stats.totalImpayes`.
- `03_data_model.md` : précision sur `grille_frais.montant_mensuel` pour un frais unique.
- `16_decisions.md` : D-016 « mois payé = soldé » ; D-017 « montant par défaut signalé si grille absente ».

## 9. Remarque hors périmètre
`dashboard.stats.totalDepenses` n'est pas filtré par année (somme de toutes les dépenses) — constaté, non corrigé ici.
