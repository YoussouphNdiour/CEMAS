# Services mensuels (garderie, renforcement, cantine) et fournitures dans le rapport — design

Date : 2026-10-16 · Statut : en attente de relecture de la spec
Demande : directeur (conversation du 2026-10-16)

## 1. Besoins
1. **Rapport de comptabilité** : les paiements « Fourniture » ne doivent plus faire partie des « Encaissements élèves ».
2. **Trois services mensuels facultatifs** : Garderie, Cours de renforcement, Cantine, 10 000 FCFA par mois chacun, pour les élèves qui y sont abonnés. Ils apparaissent dans les paiements, le suivi et les impayés.

## 2. Décisions (2026-10-16)
- Fournitures : **rubrique à part** dans le rapport ; elles restent comptées dans le solde.
- Mois dus : **du mois d'abonnement à juin** (ou jusqu'au mois d'arrêt).
- Abonnement **sur la fiche élève** (mois de début, arrêt avec mois de fin) ; liste des abonnés par service dans Finances.
- Montant **modifiable par l'administrateur** (10 000 par défaut) ; **pas de réduction** sur ces services.

## 3. Rapport de comptabilité
- Les paiements du type « Fourniture » sortent des « Encaissements élèves » et forment une rubrique **« Fournitures »** (synthèse et tableau de la section, comme les recettes).
- Solde = encaissements élèves + fournitures + recettes − dépenses − salaires (le total ne change pas).
- `construireComptabilite` reçoit les opérations avec une nature `fourniture` (nouvelle) ; le détail des opérations affiche « Fourniture » comme nature, en entrée.
- Le rapport de l'établissement (bilan) n'est pas modifié.

## 4. Données (migration 0013)
### `types_frais` : colonne `abonnement` (boolean, défaut false)
Un type « à abonnement » n'est dû que pour les élèves abonnés. Le seed crée, s'ils n'existent pas (rapprochement par nom) :
| Nom | Montant par défaut | Obligatoire | Mensuel | Abonnement |
|---|---|---|---|---|
| Garderie | 10 000 | non | oui | oui |
| Cours de renforcement | 10 000 | non | oui | oui |
| Cantine | 10 000 | non | oui | oui |
Le transport garde son fonctionnement actuel (affectations), hors périmètre.

### `abonnements`
| Colonne | Type | Contrainte |
|---|---|---|
| id | uuid | PK |
| eleve_id | uuid | FK → eleves ON DELETE CASCADE |
| type_frais_id | uuid | FK → types_frais |
| annee_scolaire_id | uuid | FK → annees_scolaires ON DELETE CASCADE |
| mois_debut | integer | 1–12 (CHECK), mois scolaire de début |
| mois_fin | integer | nullable, 1–12 (CHECK) ; null = jusqu'à juin |
| created_at | timestamptz | |
| | | UNIQUE (eleve_id, type_frais_id, annee_scolaire_id) |

Journal : la contrainte `journal_entite_check` accepte en plus `abonnement` et `service` (changement de montant).

Ordre scolaire des mois : octobre (10) → septembre (9) ; « de début à fin » se lit dans cet ordre ; juin (6) est toujours le dernier mois dû.

## 5. Règles
- **Mois dus d'un abonnement** : mois de l'année scolaire de `mois_debut` à `min(mois_fin, juin)`, limités aux mois déjà échus (même règle que la scolarité : jusqu'au mois courant).
- **Montant** : `types_frais.montant_defaut` du service (aucune réduction, aucune grille par classe).
- **Impayés** (`calculerImpayes`) : en plus des frais obligatoires, chaque abonnement de l'élève ajoute ses mois dus non payés (« Cantine — Novembre ») ; un mois avec un paiement est soldé (règle D-016). Les relances PDF et le KPI du tableau de bord en tiennent compte.
- **Paiement d'un service sans abonnement** : accepté (avertissement dans le formulaire « Élève non abonné à la cantine ») ; il n'abonne pas l'élève automatiquement.
- **Élève retiré** (inactif/transféré) : n'apparaît plus dans les impayés (règle existante).
- **Suppression d'un élève** : ses abonnements sont supprimés (cascade) ; l'action reste journalisée.

## 6. Interface
### Fiche élève — section « Services »
- Pour chaque service : état « Non abonné » / « Abonné depuis Novembre » / « Abonné de Novembre à Février » ; boutons (administrateur) :
  - « S'abonner » : mois de début (défaut : mois courant) ;
  - « Arrêter » : mois de fin (défaut : mois courant), qui doit être ≥ mois de début ;
  - « Reprendre » (efface le mois de fin) ; « Supprimer l'abonnement » si aucun paiement du service.
- Chaque action est journalisée (`entite = abonnement`).

### Finances → « Services » (`/finances/services`)
- Tarifs : montant mensuel de chaque service, modifiable par l'administrateur (journalisé).
- Abonnés par service : élève, classe, mois de début et de fin, mois payés / dus ; total par service.

### Paiements (`/finances/paiements`)
- Les trois services apparaissent dans « Type de frais » avec le montant proposé (« Cantine — 10 000 ») ; avertissement si l'élève n'est pas abonné ou si le mois est hors abonnement.

### Suivi (`/finances/suivi`)
- Une grille par service, comme la scolarité, pour les élèves de la classe : vert payé, rouge dû non payé, « — » hors abonnement. La grille d'un service n'apparaît que si au moins un élève de la classe est abonné ou l'a payé.

### Impayés et relances
- Les mois de service dus apparaissent avec les autres (« Cantine Nov ») ; filtre inchangé.

## 7. Tests
- Vitest : `moisDusAbonnement` (début en novembre, arrêt en février, juin dernier mois, mois courant) ; `calculerImpayes` avec abonnements (dû, payé, hors abonnement, pas de réduction) ; `construireComptabilite` avec la rubrique Fournitures (solde inchangé).
- e2e : abonner un élève à la cantine depuis la fiche → impayés « Cantine » ; paiement du mois → soldé ; arrêter → mois suivants non dus ; suivi (grille Cantine visible, « — » hors abonnement) ; montant modifié dans Services → proposé à la saisie ; rapport : Fourniture hors encaissements élèves.

## 8. Documentation
`02`, `03` (`abonnements`, colonne `abonnement`), `04`, `05`, `16` (D-027 services à abonnement ; précision du rapport), `10`.

## 9. Hors périmètre
Passage du transport au même système ; réductions sur les services ; abonnements recopiés au passage d'année (à refaire chaque année).
