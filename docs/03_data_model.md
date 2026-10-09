# 03 - Modèle de données

## Vue d'ensemble

Le modèle de données CEMAS est composé de 17 tables PostgreSQL réparties en 6 modules. Toutes les clés primaires sont des UUID v4 générés par `gen_random_uuid()`. Les montants financiers sont stockés en integer (FCFA, pas de centimes).

## Module Auth

### `users`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK, default random | Identifiant |
| email | varchar(255) | UNIQUE, NOT NULL | Email de connexion |
| password_hash | text | NOT NULL | Hash bcrypt du mot de passe |
| nom | varchar(200) | NOT NULL | Nom complet |
| role | varchar(20) | NOT NULL, default 'directeur' | Rôle utilisateur |
| created_at | timestamptz | default now() | Date de création |

---

## Module Paramètres (`settings`)

### `parametres_ecole`
Une seule ligne (`id = 1`), créée par la migration `0005`.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | integer | PK, default 1, CHECK (id = 1) | Ligne unique |
| nom | varchar(150) | NOT NULL | Nom de l'établissement |
| sigle | varchar(30) | NOT NULL | Sigle (sidebar, en-têtes, expéditeur email) |
| adresse | varchar(255) | | Adresse |
| telephone1 | varchar(30) | | Téléphone principal |
| telephone2 | varchar(30) | | Téléphone secondaire |
| email | varchar(150) | | Email de l'établissement |
| contacts_entete | text | | Ligne de contacts imprimée dans les en-têtes |
| prefixe_matricule | varchar(10) | NOT NULL | Préfixe des matricules élèves (`{P}-{AAAA}-{NNNN}`) |
| prefixe_recu | varchar(10) | NOT NULL | Préfixe des numéros de reçu (`{P}-{AAAA}-{NNNN}`) |
| prefixe_employe | varchar(10) | NOT NULL | Préfixe des matricules employés (`{P}-{NNN}`) |
| updated_at | timestamptz | default now() | Dernière modification |

---

## Module Académique

### `annees_scolaires`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| libelle | varchar(20) | NOT NULL | Ex: "2025-2026" |
| date_debut | date | NOT NULL | Début de l'année |
| date_fin | date | NOT NULL | Fin de l'année |
| active | boolean | NOT NULL, default false | Année active |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

### `niveaux`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| nom | varchar(50) | NOT NULL | Crèche, Préscolaire, Élémentaire |
| ordre | integer | NOT NULL | Ordre d'affichage |

### `classes`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| nom | varchar(100) | NOT NULL | Nom de la classe |
| niveau_id | uuid | FK → niveaux, NOT NULL | Niveau rattaché |
| capacite | integer | NOT NULL, default 30 | Capacité max |
| annee_scolaire_id | uuid | FK → annees_scolaires, NOT NULL | Année scolaire |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

### `matieres`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| nom | varchar(100) | NOT NULL | Nom de la matière |
| coefficient | integer | NOT NULL, default 1 | Coefficient |
| niveau_id | uuid | FK → niveaux, NOT NULL | Niveau associé |

---

## Module Élèves

### `eleves`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| matricule | varchar(20) | UNIQUE, NOT NULL | CEMAS-{année}-{seq} |
| prenom | varchar(100) | NOT NULL | Prénom |
| nom | varchar(100) | NOT NULL | Nom de famille |
| date_naissance | date | NOT NULL | Date de naissance |
| lieu_naissance | varchar(200) | nullable | Lieu de naissance |
| sexe | varchar(1) | NOT NULL | M ou F |
| adresse | text | nullable | Adresse |
| photo_url | text | nullable | URL photo |
| classe_id | uuid | FK → classes, NOT NULL | Classe actuelle |
| annee_scolaire_id | uuid | FK → annees_scolaires, NOT NULL | Année scolaire |
| statut | varchar(20) | NOT NULL, default 'actif' | actif/inactif/transfere |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

### `parents`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| prenom | varchar(100) | NOT NULL | Prénom |
| nom | varchar(100) | NOT NULL | Nom de famille |
| telephone | varchar(20) | NOT NULL | Téléphone principal |
| telephone_2 | varchar(20) | nullable | Téléphone secondaire |
| profession | varchar(100) | nullable | Profession |
| adresse | text | nullable | Adresse |
| relation | varchar(10) | NOT NULL | pere/mere/tuteur |
| created_at | timestamptz | default now() | |

### `eleve_parents` (table de jointure)
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| eleve_id | uuid | FK → eleves, ON DELETE CASCADE | |
| parent_id | uuid | FK → parents, ON DELETE CASCADE | |
| | | PK(eleve_id, parent_id) | Clé primaire composite |

### `inscriptions`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| eleve_id | uuid | FK → eleves, NOT NULL | |
| classe_id | uuid | FK → classes, NOT NULL | |
| annee_scolaire_id | uuid | FK → annees_scolaires, NOT NULL | |
| date_inscription | date | NOT NULL, default now() | |
| montant_inscription | integer | NOT NULL, default 0 | Montant inscription |
| statut | varchar(20) | NOT NULL, default 'en_attente' | en_attente/confirmee |
| created_at | timestamptz | default now() | |
| | | UNIQUE(eleve_id, annee_scolaire_id) | Un seul enregistrement par élève/année |

---

## Module Finances

### `types_frais`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| nom | varchar(100) | NOT NULL | Ex: Scolarité, Transport |
| montant_defaut | integer | NOT NULL, default 0 | Montant par défaut |
| obligatoire | boolean | NOT NULL, default true | Frais obligatoire |

### `grille_frais`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| classe_id | uuid | FK → classes, NOT NULL | |
| type_frais_id | uuid | FK → types_frais, NOT NULL | |
| annee_scolaire_id | uuid | FK → annees_scolaires, NOT NULL | |
| montant_mensuel | integer | NOT NULL | Montant mensuel |
| | | UNIQUE(classe_id, type_frais_id, annee_scolaire_id) | |

### `paiements`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| eleve_id | uuid | FK → eleves, NOT NULL | |
| type_frais_id | uuid | FK → types_frais, NOT NULL | |
| annee_scolaire_id | uuid | FK → annees_scolaires, NOT NULL | |
| mois | integer | NOT NULL | Mois (1-12) |
| montant | integer | NOT NULL | Montant payé |
| date_paiement | date | NOT NULL, default now() | |
| numero_recu | varchar(20) | UNIQUE, NOT NULL | REC-{année}-{seq} |
| note | text | nullable | |
| created_at | timestamptz | default now() | |
| | | UNIQUE(eleve_id, type_frais_id, annee_scolaire_id, mois) | |

### `categories_depenses`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| nom | varchar(100) | NOT NULL | Nom de la catégorie |

### `depenses`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| categorie_id | uuid | FK → categories_depenses, NOT NULL | |
| libelle | varchar(200) | NOT NULL | Description |
| montant | integer | NOT NULL | Montant FCFA |
| date | date | NOT NULL, default now() | |
| note | text | nullable | |
| created_at | timestamptz | default now() | |

### `categories_recettes`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| nom | varchar(100) | NOT NULL | Nom de la catégorie |

### `recettes`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| categorie_id | uuid | FK → categories_recettes, NOT NULL | |
| libelle | varchar(200) | NOT NULL | Description |
| montant | integer | NOT NULL | Montant FCFA |
| date | date | NOT NULL, default now() | |
| note | text | nullable | |
| created_at | timestamptz | default now() | |

---

## Module Paie

### `employes`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| matricule | varchar(20) | UNIQUE, NOT NULL | EMP-{seq} |
| prenom | varchar(100) | NOT NULL | Prénom |
| nom | varchar(100) | NOT NULL | Nom |
| telephone | varchar(20) | nullable | Téléphone |
| poste | varchar(100) | NOT NULL | Poste occupé |
| type | varchar(20) | NOT NULL | enseignant/administratif/entretien |
| salaire_base | integer | NOT NULL | Salaire de base FCFA |
| date_embauche | date | NOT NULL | Date d'embauche |
| statut | varchar(10) | NOT NULL, default 'actif' | actif/inactif |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

### `bulletins_paie`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| employe_id | uuid | FK → employes, NOT NULL | |
| mois | integer | NOT NULL | Mois (1-12) |
| annee | integer | NOT NULL | Année |
| salaire_base | integer | NOT NULL | Salaire de base copié |
| primes | integer | NOT NULL, default 0 | Total primes |
| retenues | integer | NOT NULL, default 0 | Total retenues |
| net_a_payer | integer | NOT NULL | Base + Primes - Retenues |
| date_paiement | date | nullable | Date effective de paiement |
| paye | boolean | NOT NULL, default false | Payé ou non |
| note | text | nullable | |
| created_at | timestamptz | default now() | |
| | | UNIQUE(employe_id, mois, annee) | |

---

## Module Transport

### `vehicules`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| immatriculation | varchar(20) | UNIQUE, NOT NULL | Plaque |
| marque | varchar(100) | nullable | Marque du véhicule |
| capacite | integer | NOT NULL | Nombre de places |
| chauffeur_nom | varchar(100) | NOT NULL | Nom du chauffeur |
| chauffeur_tel | varchar(20) | NOT NULL | Téléphone chauffeur |
| created_at | timestamptz | default now() | |

### `itineraires`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| nom | varchar(100) | NOT NULL | Nom de l'itinéraire |
| vehicule_id | uuid | FK → vehicules, nullable | Véhicule associé |
| description | text | nullable | Description |
| created_at | timestamptz | default now() | |

### `arrets`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| itineraire_id | uuid | FK → itineraires, ON DELETE CASCADE, NOT NULL | |
| nom | varchar(100) | NOT NULL | Nom de l'arrêt |
| ordre | integer | NOT NULL | Ordre dans l'itinéraire |
| heure_passage | time | nullable | Heure de passage |

### `affectations_transport`
| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| id | uuid | PK | Identifiant |
| eleve_id | uuid | FK → eleves, NOT NULL | |
| itineraire_id | uuid | FK → itineraires, NOT NULL | |
| arret_id | uuid | FK → arrets, NOT NULL | |
| annee_scolaire_id | uuid | FK → annees_scolaires, NOT NULL | |
| | | UNIQUE(eleve_id, annee_scolaire_id) | Un itinéraire par élève/année |

---

## Diagramme des relations

```
annees_scolaires ──┬── classes ──── matieres
                   │      │
                   │      ├── eleves ──── eleve_parents ──── parents
                   │      │     │
                   │      │     ├── inscriptions
                   │      │     ├── paiements ──── types_frais
                   │      │     └── affectations_transport ──── itineraires ──── arrets
                   │      │                                        │
                   │      │                                     vehicules
                   │      │
                   │      └── grille_frais ──── types_frais
                   │
                   └── (filtre global sur la plupart des requêtes)

employes ──── bulletins_paie

categories_depenses ──── depenses
categories_recettes ──── recettes

users (table isolée, auth uniquement)
```

---

> Ce fichier est la source de vérité pour le modèle de données du projet CEMAS.
