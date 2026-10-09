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

### Détail : Classes
- Nom, niveau, capacité (défaut: 30), année scolaire
- Filtrage par année scolaire et/ou niveau
- Relation avec le niveau pour affichage du nom du niveau

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
- Génération automatique du matricule : `CEMAS-{année}-{seq 4 chiffres}`
- Données élève : prénom, nom, date/lieu naissance, sexe (M/F), adresse, classe
- Données parent : prénom, nom, téléphone (+ optionnel), profession, adresse, relation (père/mère/tuteur)
- Création simultanée de l'inscription dans la table `inscriptions` avec statut `confirmee`
- Lien parent-élève via table de jointure `eleve_parents`

### Détail : Statuts élève
- `actif` (défaut), `inactif`, `transfere`

---

## Module Finances (`finance`)

| Fonctionnalité | Priorité | Description |
|---------------|----------|-------------|
| Types de frais | P0 | Liste des types de frais (scolarité, inscription, etc.) avec montant par défaut |
| Grille tarifaire | P0 | Montant mensuel par classe × type de frais × année scolaire (upsert) |
| Paiements | P0 | Enregistrement d'un paiement mensuel par élève avec numéro de reçu auto-généré |
| Suivi paiements | P0 | Grille visuelle par classe : élève × mois (Oct-Jul), pastilles vert/rouge |
| Dépenses | P0 | CRUD des dépenses avec catégorie, libellé, montant, date, note |
| Recettes | P0 | CRUD des recettes (hors paiements scolarité) avec catégorie |
| Bilan | P0 | Vue consolidée : paiements + recettes − dépenses − salaires payés = solde, avec détail par mois |

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
| KPI | P0 | 6 indicateurs : élèves, classes, paiements, dépenses, employés, masse salariale |
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
