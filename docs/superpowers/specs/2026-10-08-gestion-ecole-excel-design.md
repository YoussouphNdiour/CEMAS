# Gestion Ecole — Version Excel (design)

Date : 2026-10-08 · Statut : design validé, en attente de relecture de la spec

## 1. Objectif

Remplacer l'application web CEMAS par un classeur Excel autonome, hors ligne, nommé **Gestion Ecole**, utilisable par une seule personne sur un PC **Windows** sans serveur ni internet. Le classeur reprend les modules de l'app (Scolarité, Finances, Paie, Transport, Tableau de bord) et ajoute : impayés + relances, fiches de paie imprimables, passage à l'année suivante, sauvegarde automatique.

### Critères de réussite
- L'utilisateur ouvre `Gestion Ecole.xlsm` sur Windows, active les macros, et peut : inscrire un élève, encaisser un paiement et imprimer le reçu, voir les impayés et imprimer les relances, générer et imprimer la paie du mois, gérer le transport, consulter le bilan et le tableau de bord, passer à l'année suivante.
- Aucune étape d'installation (le fichier livré contient déjà les macros).
- Toutes les vues calculées (suivi, impayés, bilan, tableau de bord, net de paie) fonctionnent par formules, même si les macros sont désactivées.

### Contraintes
- Cible : Excel Windows (Microsoft 365 / 2019+). Construction et tests sur Excel Mac 16.113.
- Aucune protection (ni mot de passe, ni feuilles verrouillées) — choix utilisateur.
- Démarrage vide + paramètres de base (niveaux, types de frais, catégories, année 2026-2027).
- Montants en FCFA, entiers.

## 2. Approche de construction

1. `excel/build/build.py` (Python + XlsxWriter) génère la structure : feuilles, tableaux structurés (ListObjects), formules, validations de données, mise en forme conditionnelle, graphiques, modèles d'impression, données de base.
2. Excel Mac, piloté par AppleScript / xlwings, ouvre le classeur, importe les modules `excel/vba/*.bas` et `ThisWorkbook.cls` via `VBProject.VBComponents.Import`, crée les boutons, enregistre en `Gestion Ecole.xlsm`.
   - Prérequis unique : Excel → Préférences → Sécurité → « Faire confiance à l'accès au modèle d'objet du projet VBA ».
   - Repli si l'import programmatique échoue sur Mac : l'utilisateur colle une fois un module d'amorçage (`Bootstrap.bas`) qui importe le reste.
3. `excel/tests/` : scénarios pilotés par xlwings (lancer une macro, relire les cellules, comparer).
4. Livrables : `excel/dist/Gestion Ecole.xlsm`, `excel/dist/Guide d'utilisation.pdf`, `excel/dist/Checklist Windows.md`.

### Saisie : feuilles-formulaires, pas d'UserForms
Les UserForms dessinés sur Mac s'affichent mal sur Windows (tailles, polices) et ne sont pas testables ici. Chaque saisie se fait dans une feuille-formulaire (cellules de saisie jaunes, listes déroulantes, bouton « Valider » / « Effacer »). La macro valide, écrit une ligne dans le journal, vide le formulaire.

### Portabilité du code VBA
- `Application.PathSeparator` pour tous les chemins ; dossiers relatifs à `ThisWorkbook.Path`.
- Export PDF via `ExportAsFixedFormat` uniquement.
- Pas d'API Windows (`Declare`), pas de `Scripting.FileSystemObject` (absent sur Mac) — `Dir`, `MkDir`, `FileCopy`, `Kill`.
- `Option Explicit` partout.

## 3. Feuilles

| Feuille | Rôle | Type |
|---|---|---|
| Accueil | Menu à boutons vers chaque module, nom/logo de l'école, année active | navigation |
| Tableau de bord | 6 KPI (élèves, classes, paiements, dépenses, employés, masse salariale), barres paiements/mois, camembert élèves/niveau, 10 derniers paiements | formules + graphiques |
| Paramètres | École (nom, logo, adresse, tél 1/2, email), préfixes (matricule, reçu, employé), année active, tables : Années, Niveaux, Types de frais, Catégories dépenses, Catégories recettes, Matières (nom, coefficient, niveau) | données |
| Classes | Nom, niveau, capacité (défaut 30), classe suivante, effectif (formule), places restantes (formule) | données |
| Élèves | Matricule, prénom, nom, date/lieu naissance, sexe, adresse, classe, année, statut (actif/inactif/transféré), date inscription, montant inscription, parent principal (prénom, nom, relation, tél, tél 2, profession, adresse), 2e contact (nom, relation, tél) | journal |
| Inscription | Formulaire → bouton « Inscrire » | formulaire |
| Grille tarifaire | Classe × type de frais × année → montant mensuel | données |
| Saisie paiement | Élève (liste), type de frais, mois, montant (proposé depuis la grille), date, note → « Enregistrer et imprimer le reçu » | formulaire |
| Paiements | N° reçu, date, matricule, élève, classe, type, mois, montant, note, année | journal |
| Suivi | Choix classe + type de frais → élève × Oct…Juil, vert payé / rouge non payé | formules |
| Impayés | Par élève actif : dû cumulé jusqu'au mois courant, payé, reste, tél parent ; bouton « Imprimer les relances » (sélection ou tous) | formules + macro |
| Dépenses / Recettes | Date, catégorie, libellé, montant, note, année | journal |
| Bilan | Par mois Oct–Juil + total : paiements, recettes, dépenses, salaires payés, solde | formules |
| Employés | Matricule, prénom, nom, poste, type (enseignant/administratif/entretien), salaire de base, téléphone, date d'embauche, statut | données |
| Bulletins | Année, mois, matricule, employé, base, primes, retenues, net (formule), payé (O/N), date paiement ; boutons « Générer le mois », « Marquer payé », « Imprimer la fiche » | journal + macros |
| Historique paie | Mois × (base, primes, retenues, net, nb employés) pour l'année | formules |
| Véhicules | Immatriculation, marque, modèle, capacité, chauffeur, tél chauffeur | données |
| Itinéraires | Nom, véhicule, description ; Arrêts : itinéraire, ordre, nom, heure de passage | données |
| Affectations | Année, élève, itinéraire, arrêt ; doublon élève/année signalé en rouge et refusé par la macro de saisie | données |
| Modèle Reçu / Modèle Relance / Modèle Fiche de paie | Gabarits A5/A4 avec en-tête école, remplis par macro puis exportés en PDF | impression |

## 4. Règles métier

- **Année active** : une seule, choisie dans Paramètres. Toutes les vues filtrent sur elle.
- **Mois scolaires** : octobre (10) à juillet (7), dans cet ordre.
- **Matricule élève** : `{préfixe}-{AAAA}-{seq 4}` où AAAA = année de début de l'année active ; seq = max existant + 1.
- **N° reçu** : `REC-{AAAA}-{seq 4}`. **Matricule employé** : `EMP-{seq 3}`. Préfixes par défaut : `ELV`, `REC`, `EMP` (modifiables dans Paramètres).
- **Classes** : non rattachées à une année (elles persistent d'une année à l'autre) ; c'est l'élève qui porte sa classe et son année.
- **Unicité paiement** : un seul paiement par élève × type de frais × mois × année — la macro refuse le doublon avec message.
- **Montant proposé** : grille tarifaire de la classe de l'élève pour le type choisi ; modifiable.
- **Capacité** : l'inscription avertit si la classe est pleine (confirmation requise).
- **Impayés** : dû = Σ types obligatoires (montant mensuel de la grille × mois écoulés depuis octobre jusqu'au mois courant inclus) ; reste = dû − payé ; seuls les élèves actifs.
- **Paie** : net = base + primes − retenues. « Générer le mois » crée une ligne par employé actif sans bulletin ce mois-là (pas de doublon).
- **Bilan** : solde = paiements + recettes − dépenses − salaires payés. (Écart volontaire avec l'app web, qui n'inclut pas les salaires.)
- **Transport** : un élève, un seul itinéraire par année.

## 5. Macros (modules VBA)

| Module | Procédures |
|---|---|
| `modNav` | Navigation depuis Accueil, retour Accueil |
| `modIds` | `NextMatricule`, `NextRecu`, `NextEmploye` |
| `modEleves` | `Inscrire` (valide, contrôle capacité, écrit la ligne, vide le formulaire) |
| `modFinances` | `EnregistrerPaiement`, `ProposerMontant`, contrôle doublon |
| `modImpression` | `ImprimerRecu(n°)`, `ImprimerRelances(sélection)`, `ImprimerFichePaie(ligne)` → PDF dans `Recus\`, `Relances\`, `Paie\` |
| `modPaie` | `GenererMois`, `MarquerPaye` |
| `modTransport` | `Affecter` (contrôle unicité) |
| `modAnnee` | `NouvelleAnnee` |
| `modSauvegarde` | `Sauvegarder`, purge > 30 copies |
| `ThisWorkbook` | `Workbook_Open` (aller à l'Accueil), `Workbook_BeforeClose` (sauvegarde) |

### Nouvelle année (`NouvelleAnnee`)
1. Confirmation + sauvegarde préalable.
2. Copie des journaux de l'année terminée (Élèves, Paiements, Dépenses, Recettes, Bulletins, Affectations) dans `Archives\Gestion Ecole - AAAA-AAAA.xlsx` (valeurs uniquement).
3. Crée l'année suivante dans Paramètres et l'active.
4. Élèves actifs : classe ← « classe suivante » de leur classe ; si vide (dernière classe), statut → inactif (sortant).
5. Recopie la grille tarifaire sur la nouvelle année.
6. Vide Paiements, Dépenses, Recettes, Bulletins, Affectations.

### Sauvegarde
À chaque fermeture : `Sauvegardes\Gestion Ecole AAAA-MM-JJ HHMM.xlsm` via `SaveCopyAs`. Conserver les 30 plus récentes.

## 6. Gestion des erreurs

- Champs obligatoires vides → message listant les champs, rien n'est écrit.
- Doublons (paiement, affectation, bulletin) → message, rien n'est écrit.
- Échec d'export PDF (dossier inaccessible) → message avec le chemin ; la donnée reste enregistrée.
- Toute macro : `On Error` → message clair, `Application.ScreenUpdating`/`EnableEvents` restaurés.

## 7. Tests

Scénarios xlwings sur Excel Mac, sur une copie du classeur :
1. Inscrire 3 élèves → matricules `ELV-2026-0001..0003`, effectifs et places restantes à jour.
2. Paiement → n° reçu, PDF créé, suivi vert, impayés diminués ; 2e paiement identique refusé.
3. Impayés : valeurs attendues pour une date donnée ; relances PDF générées.
4. Paie : générer 2 fois le même mois → pas de doublon ; net correct ; fiche PDF.
5. Affectation transport en double refusée.
6. Bilan et tableau de bord : totaux attendus.
7. Nouvelle année : archive créée, élèves promus, sortants inactifs, grille recopiée, journaux vidés.
8. Sauvegarde à la fermeture, purge au-delà de 30.

Puis `Checklist Windows.md` : test manuel de ~10 min sur le PC cible (macros activées, boutons, PDF, sauvegarde, nouvelle année sur une copie).

## 8. Hors périmètre

Multi-utilisateur, rôles, mots de passe, notes/bulletins scolaires, SMS/email, import des données de l'app web, compatibilité Excel mobile/Online/Google Sheets.
