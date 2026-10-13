# Rapports PDF, suivi des frais inclus et blocage d'octobre (design)

Date : 2026-10-13 · Statut : en attente de relecture de la spec
Demande : directeur (conversation du 2026-10-13)

## 1. Problèmes

1. **Suivi des paiements** : la tenue (« Uniforme (2) ») est payée avec l'inscription, mais ses points restent rouges. La colonne Fourniture s'affiche pour l'élémentaire et le moyen, alors que seuls la crèche et le préscolaire ont des fournitures.
2. **Saisie** : MBENE GUEYE (Moyen) a une « Scolarité octobre » de 70 000 (REC-2026-0227) en plus de son forfait de 70 000 (REC-2026-0226), qui comprend déjà octobre. L'application avertit mais n'empêche rien.
3. **Rapports** : aucun moyen d'exporter un PDF de la comptabilité d'une période, ni un rapport d'ensemble sur l'établissement.

## 2. Décisions (2026-10-13)

- Rapport de comptabilité : **synthèse + détail** des opérations ; périodes jour, semaine, mois, année.
- Rapport d'établissement : **effectifs, finances de l'année, impayés et réductions, personnel et transport**.
- Emplacement : **menu « Rapports »** (page `/rapports`) + raccourci sur le tableau de bord.
- Octobre : **bloquer** une « Scolarité octobre » pour un élève dont le niveau a un forfait.

## 3. Suivi des paiements (`finance.suivi.byClasse` et page `/finances/suivi`)

Frais facultatifs uniques (Tenue, Fourniture), pour une classe dont le niveau a un forfait :

- **Type associé au forfait** (ligne du forfait liée au type, ex. Uniforme ↔ Tenue, Fournitures ↔ Fourniture) : un élève qui a un paiement « Inscription » sur l'année a ce frais au statut **« inclus »**, affiché en vert comme un paiement (infobulle « Inclus dans l'inscription »). Un paiement direct de ce type reste « payé ». Sans inscription ni paiement direct : non payé.
- **Type non associé** au forfait du niveau (ex. Fourniture en élémentaire et en moyen, Tenue en crèche) : la carte n'est **pas affichée**, sauf si au moins un élève de la classe a un paiement de ce type (on ne cache jamais de l'argent reçu).
- Les cartes « Frais uniques » comptent « inclus » comme payé dans leur barre de progression.
- Niveau sans forfait : affichage inchangé.

En production (vérifié le 2026-10-13) : Uniforme est associé à Tenue (préscolaire, élémentaire, moyen) et Fournitures à Fourniture (crèche, préscolaire). Aucune migration de données n'est nécessaire.

## 4. Blocage de la « Scolarité octobre »

- `finance.paiements.create` refuse (`BAD_REQUEST`) un paiement d'un frais **obligatoire et mensuel** pour le **mois 10** quand le niveau de la classe de l'élève a un forfait sur l'année du paiement, avec le message : « La mensualité d'octobre est comprise dans le forfait d'inscription ».
- Formulaire : le bouton « Enregistrer le paiement » est désactivé dans ce cas ; le message orange existant devient rouge.
- Les paiements existants (MARIEME FAYE REC-2026-0149, MBENE GUEYE REC-2026-0227) ne sont pas modifiés par l'application. Leur correction en base n'est faite que sur demande explicite du directeur, après une sauvegarde.

## 5. Rapports

### 5.1 Page `/rapports` (menu « Rapports », icône fichier)
- Carte **« Comptabilité »** : choix de la période (Jour, Semaine, Mois, Année scolaire) et de la date de référence :
  - Jour : une date (défaut aujourd'hui) ;
  - Semaine : une date → semaine du lundi au dimanche qui la contient ;
  - Mois : mois + année (défaut le mois courant) ;
  - Année scolaire : une année scolaire (défaut l'active), du `date_debut` au `date_fin`.
  - Bouton « Télécharger le PDF ».
- Carte **« Rapport de l'établissement »** : choix de l'année scolaire (défaut l'active) ; bouton « Télécharger le PDF ».
- Tableau de bord : bouton « Rapports » dans l'en-tête, qui mène à `/rapports`.

### 5.2 Rapport de comptabilité (PDF A4 portrait)
En-tête de l'école (`pdf-entete`), titre « Rapport de comptabilité », période en clair (« Semaine du 12 au 18 octobre 2026 »), date d'édition.

1. **Synthèse** :
   - Encaissements élèves, par type de frais (Inscription, Scolarité, Transport…) et total ;
   - Recettes diverses, par catégorie, et total ;
   - Dépenses, par catégorie, et total ;
   - Salaires payés (total, nombre de bulletins) ;
   - **Solde de la période** = encaissements + recettes − dépenses − salaires.
2. **Détail des opérations**, par ordre chronologique (date, puis heure de saisie) : date, nature (Paiement / Recette / Dépense / Salaire), référence (n° de reçu, catégorie, employé), libellé (élève et type de frais avec le mois, libellé de la dépense…), entrée ou sortie. Total en pied. Saut de page automatique, en-tête de colonnes répété, pagination « Page n / N ».

Règles de dates : paiements par `date_paiement` ; recettes et dépenses par `date` ; salaires par `COALESCE(date_paiement, 1er jour du mois du bulletin)` pour les bulletins payés (même règle que le bilan). Bornes incluses.

Période sans opération : PDF avec synthèse à zéro et la mention « Aucune opération sur la période ».

### 5.3 Rapport de l'établissement (PDF A4 portrait, une année scolaire)
En-tête, titre « Rapport de l'établissement — <année> », date d'édition.

1. **Effectifs** : élèves actifs par niveau et par classe (garçons, filles, total, capacité, taux de remplissage) ; total général.
2. **Finances de l'année** : totaux du bilan (encaissements, recettes, dépenses, salaires, résultat) et tableau mois par mois (réutilise `buildBilanMensuel`).
3. **Impayés et réductions** : total dû, payé et reste (`getImpayes`) ; reste par niveau et par classe ; les 10 plus gros restes (élève, classe, reste) ; réductions accordées (nombre par type, montant annuel total).
4. **Personnel et transport** : employés actifs par type, masse salariale mensuelle (somme des salaires de base) et salaires payés sur l'année ; véhicules (capacité), itinéraires et nombre d'élèves affectés.

### 5.4 Architecture
- Module `src/modules/reports/` :
  - `periode.ts` : `bornesPeriode(type, reference) → { du, au, libelle }` (pur, testé) ;
  - `comptabilite.ts` : `construireComptabilite(operations) → { synthese, operations triées, solde }` (pur, testé) ;
  - `service.ts` : requêtes de la période et de l'année ;
  - `router.ts` : `reports.comptabilite({ du, au })` et `reports.etablissement({ anneeScolaireId })` (procédures protégées, lecture seule), branché dans le routeur racine.
- PDF générés côté navigateur avec jsPDF, comme le reçu et les bulletins : `src/shared/lib/generate-rapport-comptable-pdf.ts` et `generate-rapport-etablissement-pdf.ts` (fonctions `build…(data, ecole): jsPDF`, testées).

## 6. Tests
- Vitest : `bornesPeriode` (semaine à cheval sur deux mois, dimanche, année scolaire) ; `construireComptabilite` (regroupements, tri, solde, période vide) ; règle « inclus » / « masqué » du suivi ; PDF (titres, totaux, pagination d'un détail long).
- e2e :
  - suivi : en élémentaire, pas de carte Fourniture ; Tenue « inclus » après une inscription ;
  - paiement « Scolarité octobre » refusé pour un niveau au forfait (API et bouton désactivé) ;
  - `/rapports` : téléchargement des deux PDF (événement `download`, nom du fichier), données de l'API cohérentes avec un paiement, une dépense et un salaire créés pendant le test.

## 7. Documentation
`02_features.md`, `04_api_spec.md` (`reports.*`, refus d'octobre), `05_ui_spec.md` (page Rapports, suivi), `16_decisions.md` (D-023 rapports, D-024 blocage d'octobre et frais inclus dans le suivi), `10_current_issues.md`.

## 8. Hors périmètre
Export Excel/CSV, envoi par email, rapport par caissier, impayés à date dans le rapport comptable (non retenus le 2026-10-13).
