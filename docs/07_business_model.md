# 07 - Modèle métier

## Contexte

CEMAS gère le Complexe Educatif Mame Anta Sidibe, un établissement scolaire privé à Dakar couvrant trois niveaux d'enseignement.

## Niveaux scolaires

| Niveau | Tranches d'âge typiques | Description |
|--------|------------------------|-------------|
| Crèche | 0-3 ans | Accueil de la petite enfance |
| Préscolaire | 3-6 ans | Maternelle, préparation au primaire |
| Élémentaire | 6-12 ans | Cycle primaire (CI à CM2) |

## Cycle financier

### Année scolaire
- **Durée :** Octobre à Juillet (10 mois)
- **Mois scolaires :** Oct, Nov, Déc, Jan, Fév, Mar, Avr, Mai, Jun, Jul

### Revenus
1. **Paiements de scolarité** — Mensuels, par type de frais, par élève
2. **Autres recettes** — Revenus divers catégorisés (dons, subventions, événements)

### Dépenses
- Catégorisées (fournitures, maintenance, services, etc.)
- Pas de lien avec l'année scolaire (date libre)

### Bilan
```
Solde = Σ Paiements + Σ Recettes - Σ Dépenses
```

## Grille tarifaire

La tarification est définie par :
- **Classe** × **Type de frais** × **Année scolaire** = **Montant mensuel**

Chaque combinaison unique a un montant mensuel en FCFA.

## Gestion du personnel

### Types d'employés
| Type | Description |
|------|-------------|
| Enseignant | Personnel pédagogique |
| Administratif | Personnel de bureau |
| Entretien | Personnel de maintenance et nettoyage |

### Cycle de paie
1. Génération des bulletins en masse (tous les employés actifs)
2. Ajustement individuel des primes et retenues
3. Marquage payé avec date effective

**Calcul :** `Net = Salaire de base + Primes - Retenues`

## Transport scolaire

### Organisation
```
Véhicule → Itinéraire → Arrêts (ordonnés)
                      → Affectations élèves
```

- Un véhicule peut servir plusieurs itinéraires
- Un élève est affecté à un seul itinéraire par année scolaire
- Chaque affectation précise l'arrêt de l'élève

## Matricules et identifiants

| Entité | Format | Exemple |
|--------|--------|---------|
| Élève | `CEMAS-{année}-{seq 4}` | CEMAS-2025-0001 |
| Employé | `EMP-{seq 3}` | EMP-001 |
| Reçu paiement | `REC-{année}-{seq 4}` | REC-2025-0001 |

---

> Ce fichier est la source de vérité pour le modèle métier du projet CEMAS.
