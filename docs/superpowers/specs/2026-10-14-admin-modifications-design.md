# Modifier et supprimer élèves, paiements et employés (administrateur) — design

Date : 2026-10-14 · Statut : en attente de relecture de la spec
Demande : directeur (conversation du 2026-10-14)

## 1. Problème
Les corrections de la semaine (doublons, mauvais montants, mauvaise classe) ont dû être faites directement en base. L'administrateur doit pouvoir les faire lui-même dans l'application :
- **élèves** : la modification et la suppression existent côté serveur, sans aucun écran ; une suppression échoue si l'élève a des paiements ;
- **paiements** : ni modification ni suppression ;
- **employés** : les boutons existent, mais la suppression échoue pour un employé qui a des bulletins (cas des 12 employés).

## 2. Décisions (2026-10-14)
- Droits : **administrateur seulement** (sans redemander le mot de passe).
- Élève avec paiements : suppression **refusée**, proposer **« Retirer de l'école »** (statut inactif ou transféré).
- **Journal** des modifications et suppressions (qui, quand, avant/après, motif).
- Employé avec bulletins : suppression **refusée**, proposer **« Désactiver »**.

## 3. Rôle administrateur
- Est administrateur un utilisateur dont `users.role` vaut `directeur` ou `admin` (le compte actuel l'est déjà ; aucune migration de données).
- `adminProcedure` (`src/shared/lib/trpc.ts`) : comme `protectedProcedure`, puis lit le rôle en base (`users.id = session.user.id`) ; sinon `FORBIDDEN` « Action réservée à l'administrateur ». Le rôle n'est pas mis dans le jeton (il serait périmé après un changement).
- `settings.moi` (ou équivalent) renvoie `{ estAdmin }` pour que l'interface masque les boutons ; le serveur reste la seule barrière.
- Hors périmètre : écran de gestion des comptes (création d'un compte « secrétaire » plus tard).

## 4. Journal (`journal_modifications`, migration 0012)
| Colonne | Type | Contrainte |
|---|---|---|
| id | uuid | PK |
| created_at | timestamptz | défaut now() |
| user_id | uuid | FK → users, nullable (ON DELETE SET NULL) |
| user_nom | varchar(100) | nom affiché au moment de l'action |
| entite | varchar(20) | `eleve` \| `contact` \| `paiement` \| `employe` (CHECK) |
| entite_id | uuid | identifiant de la ligne concernée (pas de FK : elle peut être supprimée) |
| action | varchar(20) | `modification` \| `suppression` (CHECK) |
| libelle | varchar(200) | ex. « REC-2026-0150 — MARIEME FAYE », « CEMAS-2026-0037 — SEYDINA OUSMANE DIOP » |
| avant | jsonb | valeurs avant (champs modifiés seulement pour une modification ; ligne entière pour une suppression) |
| apres | jsonb | valeurs après (null pour une suppression) |
| motif | varchar(300) | obligatoire pour un paiement, facultatif sinon |

L'écriture du journal se fait dans la **même transaction** que la modification. Une modification sans changement réel n'écrit rien.

Page **Paramètres → Journal** (`/parametres/journal`, administrateur) : tableau date, utilisateur, objet (libellé), action, détail « champ : avant → après », motif ; filtres par type d'objet et par période ; 50 lignes par page.

## 5. Élèves
### Modifier (fiche élève, bouton « Modifier »)
- Champs : prénom, nom, date et lieu de naissance, sexe, adresse, classe (classes de l'année de l'élève), statut.
- `students.update` devient `adminProcedure` ; en transaction :
  - contrôle des doublons (règle D-025 : même année, prénom, nom, date de naissance normalisés), **en excluant l'élève lui-même** → `CONFLICT` avec le matricule de l'autre fiche ;
  - changement de classe : seulement vers une classe de la même année ; met aussi à jour `inscriptions.classe_id` de cette année ;
  - journal (champs modifiés ; la classe en clair, ex. « classe : CP → CE1 »).
- Si la classe change de niveau, message d'information après enregistrement : « Les tarifs du niveau <X> s'appliquent désormais (forfait, mensualités). »

### Contacts (parents)
- Sur la fiche élève, chaque contact a « Modifier » : prénom, nom, téléphone, lien, profession, e-mail (champs existants). Nouvelle procédure `students.updateParent` (administrateur), journal (`entite = contact`). Un parent partagé par plusieurs enfants est modifié pour tous (message l'indiquant).

### Supprimer (bouton « Supprimer » de la fiche)
- Refusée (`BAD_REQUEST`) si l'élève a au moins un paiement : « Cet élève a des paiements : utilisez “Retirer de l'école” pour garder la comptabilité. »
- Sinon, en transaction : suppression des affectations de transport, réductions, décisions de passage, inscriptions, liens parents, puis de l'élève ; parents qui n'ont plus d'enfant supprimés ; journal (ligne entière). Fenêtre de confirmation avec le nom et le matricule.

### Retirer de l'école
- Bouton « Retirer de l'école » : choix « Inactif » ou « Transféré » + motif facultatif → `students.update` (statut) ; journal. Un élève retiré n'apparaît plus dans les impayés ni les effectifs actifs ; ses paiements restent.
- « Réintégrer » remet le statut à actif.

## 6. Paiements
Dans la liste des paiements du mois (`/finances/paiements`) et dans l'historique de la fiche élève : boutons « Modifier » et « Supprimer » (administrateur).

### Modifier
- Champs : type de frais, mois, montant, date de paiement ; **motif obligatoire**. Le numéro de reçu ne change pas ; un reçu réimprimé montre les nouvelles valeurs.
- `finance.paiements.update` (administrateur), en transaction, avec les mêmes règles qu'à la saisie :
  - montant entier > 0 ;
  - scolarité d'octobre refusée pour un niveau au forfait (D-024) ;
  - unicité élève × type × année × mois : message clair « Ce mois est déjà payé pour ce type (reçu REC-…) » au lieu d'une erreur technique ;
  - journal (champs modifiés + motif).

### Supprimer
- `finance.paiements.delete` (administrateur) avec **motif obligatoire**, fenêtre de confirmation montrant reçu, élève, type, mois, montant ; journal (ligne entière + motif). Le numéro de reçu n'est jamais réutilisé (la séquence continue).

## 7. Employés
- `payroll.employes.update` et `delete` deviennent `adminProcedure`, avec journal.
- Suppression refusée si l'employé a des bulletins : « Cet employé a des bulletins de paie : désactivez-le pour garder l'historique. » La page Employés propose alors « Désactiver » (statut inactif) ; « Réactiver » pour revenir.
- Un employé inactif n'est plus proposé dans la génération des bulletins (vérifier le comportement actuel et l'aligner).

## 8. Interface (règles communes)
- Boutons Modifier/Supprimer visibles seulement pour l'administrateur.
- Toute suppression passe par une fenêtre de confirmation (composant `ConfirmDialog` existant) ; motif obligatoire pour un paiement.
- Après une action : listes, impayés, tableau de bord et tarifs de l'élève rafraîchis.

## 9. Tests
- Vitest : construction du détail « avant → après » du journal (champs modifiés seulement, classe en clair) ; normalisation pour les doublons (fonction partagée avec `students.create`).
- e2e :
  - élève : modifier nom et classe (journal écrit, inscription mise à jour) ; doublon refusé en modification ; suppression refusée avec paiement, acceptée sans paiement ; retirer puis réintégrer ;
  - contact : modifier le nom d'un parent ;
  - paiement : modifier montant et mois (motif obligatoire, mois déjà payé refusé, octobre refusé), supprimer (motif obligatoire), reçu réimprimé à jour ;
  - employé : suppression refusée avec bulletins, désactiver/réactiver, suppression sans bulletin ;
  - droits : un utilisateur non administrateur (créé par le test en base jetable) reçoit `FORBIDDEN` ;
  - page Journal : les actions ci-dessus y apparaissent.

## 10. Documentation
`02`, `03` (table `journal_modifications`), `04` (procédures, `adminProcedure`), `05` (boutons, page Journal), `16` (D-026 droits et journal), `10`.

## 11. Hors périmètre
Gestion des comptes utilisateurs, restauration depuis le journal (annuler une action), modification des dépenses/recettes (elles ont déjà la suppression), modification d'un bulletin payé.
