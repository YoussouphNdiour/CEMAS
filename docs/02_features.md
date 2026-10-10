# 02 - Fonctionnalités

## Module Académique (`academic`)

| Fonctionnalité | Priorité | Description |
|---------------|----------|-------------|
| Années scolaires | P0 | CRUD des années scolaires (libellé, dates début/fin). Activation d'une seule année à la fois |
| Niveaux | P0 | Liste des niveaux prédéfinis (Crèche, Préscolaire, Élémentaire) avec ordre |
| Classes | P0 | CRUD des classes rattachées à un niveau et une année scolaire. Capacité configurable |
| Matières | P0 | CRUD des matières par niveau avec coefficient |

### Détail : Années scolaires
- Création avec libellé (ex: `2025-2026`), date début, date fin
- Activation exclusive : une seule année active à la fois (toggle dans une transaction)
- Suppression possible (pas de soft delete)
- **Passage à l'année suivante** (`/academique/annees/passage`, lien sur l'année active) : assistant en 4 étapes — nouvelle année (libellé et dates préremplis +1 an) ; classe suivante de chaque classe (obligatoire) ; décision par élève actif (Passe par défaut, Redouble, Quitte) ; vérification (comptes par classe, effectifs prévus, alerte de dépassement) puis confirmation
- **Fenêtre** : préparation possible à tout moment (classes suivantes, décisions enregistrées par « Enregistrer les décisions ») ; **lancement seulement après la date de fin de l'année active** (1er août pour une fin au 31 juillet), refusé par le serveur avant
- **Étape 5 « Contrôles et lancement »** : dernière sauvegarde (moins de 24 h, sinon bloquant ; bouton « Faire une sauvegarde maintenant »), impayés restants (information), trois cases obligatoires (classes vérifiées, redoublants décidés, grille revue) ; une sauvegarde `prepassage-…dump` est faite juste avant, le passage n'a lieu que si elle a réussi
- **Bandeaux du tableau de bord** : « préparez le passage » du 15 juin à la date de fin (avec le nombre de classes sans classe suivante), puis « passez à l'année suivante » après la date de fin, jusqu'au passage
- Exécution atomique : année cible créée ou réutilisée (même libellé non archivée) ; classes et grille recopiées par nom sans doublon ni écrasement ; élèves qui restent → nouvelle classe, nouvelle année et nouvelle inscription ; sortants (fin de cycle) et départs → `inactif`, rattachés à l'ancienne année ; nouvelle année active, ancienne archivée. Une sauvegarde récente est recommandée (`docs/19_sauvegardes.md`)

### Détail : Classes
- Nom, niveau, capacité (défaut: 30), année scolaire
- Filtrage par année scolaire et/ou niveau
- Relation avec le niveau pour affichage du nom du niveau
- Classe suivante : autre classe de la même année, ou « Fin de cycle » (les élèves qui passent quittent l'école) ; « À configurer » sinon
- Effectif (élèves **actifs** de la classe) affiché `effectif / capacité`, et places restantes en badge : vert, orange à 10 % de places ou moins, rouge « Complète » ou « Dépassement : N »

### Détail : Matières
- Nom, coefficient (défaut: 1), niveau associé
- Filtrage par niveau

---

## Module Élèves (`students`)

| Fonctionnalité | Priorité | Description |
|---------------|----------|-------------|
| Liste des élèves | P0 | Tableau avec filtres par classe, niveau, statut, recherche textuelle |
| Inscription | P0 | Formulaire d'inscription avec données élève + parent/tuteur en une seule étape |
| Fiche élève | P0 | Page détaillée avec infos personnelles, classe, parent/tuteur |
| Comptage par niveau | P0 | Statistiques d'effectifs par niveau pour le dashboard |

### Détail : Inscription
- Génération automatique du matricule : `{préfixe}-{année}-{seq 4 chiffres}` (préfixe configurable dans Paramètres)
- Données élève : prénom, nom, date/lieu naissance, sexe (M/F), adresse, classe
- Données parent : prénom, nom, téléphone (+ optionnel), profession, adresse, relation (père/mère/tuteur)
- Création simultanée de l'inscription dans la table `inscriptions` avec statut `confirmee`
- Lien parent-élève via table de jointure `eleve_parents`
- 2e contact optionnel (bloc « Ajouter un 2e contact ») ; le premier est le contact **principal** (utilisé sur les reçus). Un 2e contact peut aussi être ajouté depuis la fiche élève (2 contacts max)
- Capacité : le choix de classe affiche le remplissage ; une classe pleine affiche un avertissement et l'inscription demande une confirmation (pas de blocage)

### Détail : Statuts élève
- `actif` (défaut), `inactif`, `transfere`

---

## Module Finances (`finance`)

| Fonctionnalité | Priorité | Description |
|---------------|----------|-------------|
| Types de frais | P0 | Liste des types de frais (scolarité, inscription, etc.) avec montant par défaut |
| Tarifs par niveau | P0 | Page `/finances/tarifs` : forfait d'inscription (lignes : frais généraux, uniforme, fournitures, mensualité d'octobre… ; un type de frais peut être associé à une ligne, ex. Fourniture) et échéancier mensuel (novembre → mai par défaut, octobre inclus dans le forfait) par niveau et par année |
| Réductions | P0 | Une réduction par élève et par année (fratrie à partir de 4 enfants, enfant du personnel, négociée, gratuité/bourse), sur le forfait, les mensualités ou les deux, en montant ou en pourcentage ; saisie sur la fiche élève, liste `/finances/reductions` |
| Grille tarifaire (ancienne) | P1 | Page `/finances/grille` : montant par classe × frais obligatoire de l'année active ; cases vides = montant par défaut (signalé) ; « Appliquer au niveau » |
| Impayés | P0 | Page `/finances/impayes` : élèves actifs avec un reste à payer (dû, payé, reste, mois impayés, téléphone du contact principal), filtres niveau/classe, totaux |
| Relances | P0 | Lettre de relance PDF (A4) par élève ou pour une sélection (une page par élève), en-tête de l'école |
| Paiements | P0 | Enregistrement d'un paiement mensuel par élève avec numéro de reçu auto-généré |
| Suivi paiements | P0 | Grille visuelle par classe : élève × mois (Oct-Jul), pastilles vert/rouge |
| Dépenses | P0 | CRUD des dépenses avec catégorie, libellé, montant, date, note |
| Recettes | P0 | CRUD des recettes (hors paiements scolarité) avec catégorie |
| Bilan | P0 | Vue consolidée : paiements + recettes − dépenses − salaires payés = solde, avec détail par mois |

### Détail : Forfait, échéancier et réductions
- Le paiement « Inscription » est le **forfait** du niveau (total de la fiche, mensualité d'octobre comprise) ; la secrétaire le saisit en une fois ; le montant est proposé selon le niveau de l'élève (après réduction) et le reçu affiche le détail du forfait et la réduction
- Formulaire de paiement : les types de frais affichent les montants du niveau de l'élève choisi (« Inscription — forfait 65 000 », « Scolarité — 24 000 (janvier) », « inclus dans le forfait ») ; aucun montant par défaut avant le choix de l'élève ; avertissements (frais déjà dans le forfait, octobre inclus, mois non dû)
- Valeurs 2026-2027 (fiches) : Crèche 80 000 puis 40 000/mois ; Préscolaire 67 000 puis 20 000 ; Élémentaire 65 000 puis 20 000 (nov-déc) et 24 000 (janv-mai) ; Moyen 70 000 puis 25 000 et 30 000. Juin réparti sur janvier-mai, rien en juillet
- Réduction : montant réduit = max(0, tarif − réduction) ; un montant fixe s'applique par mois pour les mensualités

### Détail : Impayés
- Élèves : statut `actif`, classe de l'année active ; frais : types `obligatoire` uniquement
- Mois dus : du mois de début de l'année au mois courant inclus (plafonné à la fin de l'année)
- Frais mensuel : un mois avec un paiement est **soldé**, quel que soit le montant (remises)
- Frais unique (`mensuel = false`, ex. Inscription) : dû une fois, soldé par tout paiement de ce frais dans l'année
- Montant : **tarifs du niveau** (forfait et échéancier, après réduction) ; à défaut grille de la classe, sinon montant par défaut du frais (classe signalée)
- Forfait : reste = forfait − (paiements Inscription + paiements des types associés, ex. Fourniture) ; un forfait payé en partie reste dû
- Scolarité : seuls les mois de l'échéancier sont dus (octobre inclus dans le forfait) ; suivi des paiements : octobre « Inclus », mois hors échéancier « — »
- Dû = mensuels × mois dus + uniques ; Payé = paiements réels (avances comprises) ; Reste = mois impayés + uniques non payés
- Calcul : `src/modules/finance/impayes.ts` (pur, Vitest) via `getImpayes` (`impayes-service.ts`)

### Détail : Paiements
- Numéro de reçu auto-généré : `REC-{année}-{seq 4 chiffres}`
- Contrainte d'unicité : un seul paiement par élève × type × année × mois
- Paiement en espèces uniquement (pas de mode de paiement à stocker)

### Détail : Suivi
- Année scolaire : mois d'octobre (10) à juillet (7)
- Grille par type de frais avec pastilles colorées (vert = payé, rouge = non payé)
- Filtrage par classe

### Détail : Bilan
- Calcul : Solde = paiements + recettes − dépenses − **salaires payés**
- Filtré par année scolaire active (salaires : bulletins `paye = true` dont la période tombe dans l'année scolaire)
- 5 indicateurs : paiements, recettes, dépenses, salaires payés, solde
- Détail par mois (vue trésorerie) : chaque montant est rattaché au mois où l'argent a bougé (date de paiement, date de la dépense/recette, date de paiement du bulletin ou à défaut son mois). Octobre → juillet toujours affichés ; un autre mois (ex. septembre) apparaît s'il a des mouvements. Colonnes : paiements, recettes, dépenses, salaires, solde du mois, solde cumulé ; ligne de total égale aux indicateurs

---

## Module Paie (`payroll`)

| Fonctionnalité | Priorité | Description |
|---------------|----------|-------------|
| Employés | P0 | CRUD du personnel avec matricule, poste, type, salaire de base |
| Bulletins de paie | P0 | Génération mensuelle des bulletins pour tous les employés actifs |
| Édition inline | P0 | Modification des primes et retenues directement dans le tableau |
| Historique | P0 | Vue annuelle avec totaux mensuels (base, primes, retenues, net) |

### Détail : Employés
- Matricule auto-généré : `EMP-{seq 3 chiffres}`
- Types : `enseignant`, `administratif`, `entretien`
- Statut : `actif` (défaut) ou `inactif`

### Détail : Bulletins
- Génération en masse : crée un bulletin pour chaque employé actif qui n'en a pas encore
- Net = Salaire de base + Primes - Retenues (recalculé côté serveur)
- Marquer payé : met `paye = true` et enregistre la date de paiement
- Fiche de paie PDF (A5, en-tête de l'école) : bouton « Fiche » par ligne (`fiche-paie-<matricule>-AAAA-MM.pdf`) et « Imprimer les fiches du mois » (un PDF, une page par bulletin, `fiches-paie-AAAA-MM.pdf`). Contenu : employé, matricule, poste, période, base, primes, retenues, net, statut payé/date, note, signatures

### Détail : Statistiques bulletins
- Total net, total primes, total retenues, nombre d'employés pour un mois/année donné

---

## Module Transport (`transport`)

| Fonctionnalité | Priorité | Description |
|---------------|----------|-------------|
| Véhicules | P0 | CRUD des véhicules avec immatriculation, marque, capacité, chauffeur |
| Itinéraires | P0 | CRUD des itinéraires avec véhicule associé et arrêts ordonnés |
| Arrêts | P0 | Gestion des arrêts par itinéraire avec ordre et heure de passage |
| Affectations | P0 | Association élève → itinéraire → arrêt par année scolaire |

### Détail : Affectations
- Contrainte d'unicité : un élève ne peut être affecté qu'à un seul itinéraire par année
- Affichage avec nom de l'élève, itinéraire et arrêt

---

## Module Tableau de bord (`dashboard`)

| Fonctionnalité | Priorité | Description |
|---------------|----------|-------------|
| KPI | P0 | 7 indicateurs : élèves, classes, paiements, dépenses, impayés (lien vers la page), employés, masse salariale |
| Graphique barres | P0 | Paiements mensuels (Recharts BarChart) |
| Graphique camembert | P0 | Répartition élèves par niveau (Recharts PieChart) |
| Paiements récents | P0 | Tableau des 10 derniers paiements |

---

## Page Paramètres

| Fonctionnalité | Priorité | Description |
|---------------|----------|-------------|
| Infos école | P0 | Édition des informations de l'établissement (nom, sigle, adresse, téléphones, email, ligne de contacts des en-têtes) utilisées par la sidebar, la page de connexion, l'en-tête d'impression, les reçus PDF et l'expéditeur des emails |
| Préfixes d'identifiants | P0 | Préfixes configurables des matricules élèves, numéros de reçu et matricules employés (2 à 10 caractères, majuscules et chiffres). S'appliquent aux nouveaux identifiants uniquement |
| Infos compte | P0 | Email et rôle de l'utilisateur connecté (via session) |
| Niveaux | P0 | Vue d'ensemble des niveaux configurés |

Le produit s'appelle **Gestion Ecole** (titre du navigateur, page de connexion) ; le nom de l'établissement est une donnée.

---

> Ce fichier est la source de vérité pour les fonctionnalités du projet CEMAS.
