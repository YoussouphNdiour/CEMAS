# 13 - Analyse des lacunes et vérification

## Couverture fonctionnelle

| Module | Fonctionnalités prévues | Implémentées | Manquantes |
|--------|------------------------|--------------|------------|
| Académique | 4 | 4 | 0 |
| Élèves | 4 | 4 | 0 |
| Finances | 7 | 7 | 0 |
| Paie | 4 | 4 | 0 |
| Transport | 4 | 4 | 0 |
| Dashboard | 4 | 4 | 0 |
| Paramètres | 3 | 3 | 0 |
| **Total** | **30** | **30** | **0** |

## Lacunes identifiées

### Fonctionnelles (non implémentées)

| # | Module | Lacune | Impact | Priorité |
|---|--------|--------|--------|----------|
| G-01 | Finance | Export PDF des reçus de paiement | Le directeur ne peut pas imprimer de reçus | P1 |
| G-02 | Paie | Export PDF des bulletins de paie | Pas de document formel pour les employés | P1 |
| G-03 | Élèves | Modification du parent/tuteur | Impossible de corriger les infos parent | P1 |
| G-04 | Élèves | Upload photo | Champ photo_url existe mais pas d'interface | P2 |
| G-05 | Finance | Filtrage temporel du bilan | Dépenses/recettes non filtrées par période | P1 |
| G-06 | Transport | Validation capacité véhicule | Suraffectation possible | P2 |
| G-07 | Général | Logs d'audit | Pas de traçabilité des actions | P2 |
| G-08 | Général | Backup automatique | Risque de perte de données | P1 |
| G-09 | Général | Notifications SMS | Parents non informés des impayés | P2 |

### Techniques

| # | Aspect | Lacune | Impact |
|---|--------|--------|--------|
| T-01 | Déploiement | Pas de Dockerfile / Docker Compose | Déploiement manuel uniquement |
| T-02 | Tests | Aucun test unitaire ou d'intégration | Pas de filet de sécurité pour les régressions |
| T-03 | CI/CD | Pas de pipeline | Build et déploiement manuels |
| T-04 | Sécurité | Pas de rate limiting sur l'API | Vulnérable au brute force |
| T-05 | Performance | Pas de cache côté serveur | Requêtes DB à chaque appel |

## Vérification de cohérence

### Schéma ↔ Routeur

| Table | Routeur correspondant | Statut |
|-------|----------------------|--------|
| annees_scolaires | academic.annees | ✅ |
| niveaux | academic.niveaux | ✅ |
| classes | academic.classes | ✅ |
| matieres | academic.matieres | ✅ |
| eleves | students | ✅ |
| parents | students (via create) | ✅ |
| eleve_parents | students (via create) | ✅ |
| inscriptions | students (via create) | ✅ |
| types_frais | finance.typesFrais | ✅ |
| grille_frais | finance.grilleFrais | ✅ |
| paiements | finance.paiements | ✅ |
| categories_depenses | finance.depenses.categories | ✅ |
| depenses | finance.depenses | ✅ |
| categories_recettes | finance.recettes.categories | ✅ |
| recettes | finance.recettes | ✅ |
| employes | payroll.employes | ✅ |
| bulletins_paie | payroll.bulletins | ✅ |
| vehicules | transport.vehicules | ✅ |
| itineraires | transport.itineraires | ✅ |
| arrets | transport.arrets | ✅ |
| affectations_transport | transport.affectations | ✅ |
| users | Auth.js (interne) | ✅ |

### Routeur ↔ Page

| Routeur | Page correspondante | Statut |
|---------|-------------------|--------|
| academic.annees | /academique/annees | ✅ |
| academic.classes | /academique/classes | ✅ |
| academic.matieres | /academique/matieres | ✅ |
| students | /eleves, /eleves/nouveau, /eleves/[id] | ✅ |
| finance.paiements | /finances/paiements | ✅ |
| finance.suivi | /finances/suivi | ✅ |
| finance.depenses | /finances/depenses | ✅ |
| finance.recettes | /finances/recettes | ✅ |
| finance.bilan | /finances/bilan | ✅ |
| payroll.employes | /payroll/employes | ✅ |
| payroll.bulletins | /payroll/bulletins | ✅ |
| payroll.historique | /payroll/historique | ✅ |
| transport.vehicules | /transport/vehicules | ✅ |
| transport.itineraires | /transport/itineraires | ✅ |
| transport.affectations | /transport/affectations | ✅ |
| dashboard | / | ✅ |

---

> Ce fichier est la source de vérité pour l'analyse des lacunes du projet CEMAS.
