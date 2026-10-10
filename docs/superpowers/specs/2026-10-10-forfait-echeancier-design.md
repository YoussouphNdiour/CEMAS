# Forfait d'inscription et échéancier par niveau (design)

Date : 2026-10-10 · Statut : design validé en conversation, en attente de relecture de la spec
Source : fiches d'inscription 2026-2027 (photos fournies par le directeur)

## 1. Problème

La secrétaire enregistre le **total de la fiche d'inscription** (60 000 / 65 000 / 70 000 / 80 000) en un seul paiement « Inscription ». Ce total **inclut la mensualité d'octobre**, mais l'application l'ignore : en production, 149 élèves sur 150 apparaissent sans scolarité d'octobre (faux impayés). Par ailleurs les fiches prévoient des mensualités différentes selon le mois (juin réparti sur janvier-mai, rien en juillet), alors que l'application compte un montant unique d'octobre à juillet.

## 2. Décisions (conversation du 2026-10-10)

- Saisie : **un paiement « forfait »** (« Inscription ») du total de la fiche ; l'application connaît la composition par niveau.
- Préscolaire : fournitures 7 000 **dans le forfait** (total 67 000) ; les élèves ayant payé 60 000 + 7 000 (« Fourniture » séparée) sont à jour.
- Échéancier **comme les fiches** : octobre dans le forfait, puis novembre → mai ; montants par mois ; rien en juin/juillet.
- Forfait payé en partie : **reste = forfait − payé** (apparaît dans les impayés et les relances).
- Crèche : FG 30 000 + Fournitures 10 000 + Mensualité 40 000 = 80 000 ; 40 000 par mois ensuite.
- Données corrigées à la main le 2026-10-10 (après sauvegarde) : REC-2026-0001 → 60 000, REC-2026-0164 → 65 000.

## 3. Valeurs 2026-2027 (d'après les fiches)

| Niveau | Forfait d'inscription | Total | Nov-Déc | Janv-Mai (+1/5 juin) |
|---|---|---|---|---|
| Crèche | Frais généraux 30 000 · Fournitures 10 000 · Mensualité octobre 40 000 | 80 000 | 40 000 | 40 000 |
| Préscolaire | Frais généraux 32 500 · Uniforme (2) 10 000 · Fournitures 7 000 · Mensualité octobre 17 500 | 67 000 | 20 000 | 20 000 |
| Élémentaire | Frais généraux 32 500 · Uniforme (2) 12 500 · Mensualité octobre 20 000 | 65 000 | 20 000 | 24 000 |
| Moyen | Frais généraux 30 000 · Uniforme (2) 15 000 · Mensualité octobre 25 000 | 70 000 | 25 000 | 30 000 |

## 4. Données (migration 0009)

### `forfait_lignes`
| Colonne | Type | Contrainte |
|---|---|---|
| `id` | uuid | PK |
| `niveau_id` | uuid | FK → niveaux, NOT NULL |
| `annee_scolaire_id` | uuid | FK → annees_scolaires ON DELETE CASCADE, NOT NULL |
| `libelle` | varchar(60) | NOT NULL |
| `montant` | integer | NOT NULL, ≥ 0 |
| `ordre` | integer | NOT NULL |
| `type_frais_id` | uuid | FK → types_frais, nullable — les paiements de ce type comptent pour le forfait (ex. « Fournitures » ↔ Fourniture) |

### `echeancier`
| Colonne | Type | Contrainte |
|---|---|---|
| `niveau_id` | uuid | FK → niveaux |
| `annee_scolaire_id` | uuid | FK → annees_scolaires ON DELETE CASCADE |
| `mois` | integer | 1–12 |
| `montant` | integer | NOT NULL, ≥ 0 |
| | | PK (niveau_id, annee_scolaire_id, mois) |

Un mois absent de l'échéancier n'est pas dû. Octobre n'y figure pas (inclus dans le forfait).

### Valeurs initiales
Le seed insère les valeurs du § 3 pour l'année active **si le niveau n'a encore ni forfait ni échéancier** pour cette année (rapprochement par nom de niveau ; ligne « Fournitures » associée au type Fourniture). Le seed tourne à chaque démarrage : la production reçoit les valeurs au déploiement, sans écraser une saisie ultérieure.

## 5. Règles de calcul (impayés, relances, KPI)

Pour un élève actif de l'année, niveau `N` :

- **Forfait (frais « Inscription »)** — si `N` a un forfait :
  - dû = Σ lignes du forfait ;
  - payé = Σ paiements « Inscription » de l'élève sur l'année + Σ paiements des types associés aux lignes (ex. Fourniture) ;
  - reste = max(0, dû − payé) ; s'il est positif, une ligne « Inscription (forfait) » de ce montant dans les mois impayés.
- **Scolarité (frais obligatoire mensuel)** — si `N` a un échéancier :
  - mois dus = mois de l'échéancier compris entre le début de l'année et le mois courant ;
  - montant d'un mois = montant de l'échéancier pour ce mois ;
  - un mois avec un paiement est soldé (règle D-016 inchangée).
- **Repli** : niveau sans forfait/échéancier → règles actuelles (grille de la classe, sinon montant par défaut, classe signalée).
- « Payé » (colonne) inclut les paiements des types associés au forfait.

## 6. Interface

### Finances → Tarifs par niveau (`/finances/tarifs`, remplace « Grille tarifaire » dans la sidebar)
- Une carte par niveau (année active) :
  - **Forfait d'inscription** : lignes (libellé, montant, type de frais associé optionnel), ajout/suppression, total calculé ;
  - **Échéancier** : un champ par mois d'octobre à juillet (octobre grisé « inclus dans le forfait » ; vide = non dû), raccourcis « Novembre-décembre » / « Janvier-mai » pour remplir plusieurs mois.
- « Enregistrer » par niveau (remplace forfait et échéancier du niveau dans une transaction).
- La page « Grille tarifaire » reste accessible par un lien « Grille par classe (ancienne méthode) » ; les impayés ne l'utilisent que pour les niveaux non configurés.

### Paiements
- Type « Inscription » + élève choisi → montant **proposé** = total du forfait de son niveau (modifiable).
- Type « Scolarité » + mois choisi → montant proposé = montant de l'échéancier du niveau pour ce mois.

### Reçu PDF
- Paiement « Inscription » d'un élève dont le niveau a un forfait : le reçu affiche le **détail du forfait** (lignes et total) sous le montant payé.

### Suivi des paiements (`/finances/suivi`)
- Pour la scolarité : octobre affiché « Inclus » (couvert par l'inscription) ; mois hors échéancier (juin, juillet) affichés « — ».

## 7. Passage à l'année suivante

`executerPassage` recopie aussi les forfaits et l'échéancier de chaque niveau vers la nouvelle année (sans écraser une saisie existante).

## 8. Tests

- Vitest (`impayes.test.ts`) : forfait complet payé (Inscription seule) → à jour ; forfait 60 000 + Fourniture 7 000 associée → à jour ; forfait partiel 40 000 / 80 000 → reste 40 000 ; échéancier : octobre non dû, novembre 20 000, janvier 24 000, juin/juillet non dus ; niveau sans configuration → repli sur la grille.
- Vitest reçu : détail du forfait présent dans le PDF.
- e2e : page Tarifs (modifier un montant, enregistrer, total) ; paiement « Inscription » prérempli au total du forfait ; impayés d'un élève au forfait partiel.

## 9. Documentation
`02_features.md`, `03_data_model.md`, `04_api_spec.md`, `05_ui_spec.md`, `16_decisions.md` (D-021 forfait d'inscription et échéancier par niveau ; D-016 précisé : le forfait n'est pas soldé par un paiement partiel), `10_current_issues.md` (entrée sur les faux impayés d'octobre résolue).

## 10. Vérification en production (après déploiement, lecture seule)
- Forfaits et échéanciers 2026-2027 présents pour les 4 niveaux.
- Impayés : les élèves ayant payé le forfait complet n'ont plus d'octobre impayé ; JOSHUA NGOMA reste 40 000, EDOUARD MICHEL NDIONE reste 5 000 (ou à corriger si erreur de saisie).
