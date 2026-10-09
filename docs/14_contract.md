# 14 - Contrat du projet

## Périmètre

### Inclus
- Application web de gestion scolaire complète
- Gestion académique : années, niveaux, classes, matières
- Gestion des élèves : inscription, suivi, fiche détaillée
- Gestion financière : paiements mensuels, dépenses, recettes, bilan
- Gestion de la paie : employés, bulletins mensuels, historique
- Gestion du transport : véhicules, itinéraires, affectations
- Tableau de bord avec KPIs et graphiques
- Page de paramètres
- Authentification mono-utilisateur

### Exclu
- Multi-tenant (plusieurs écoles)
- Multi-utilisateur (plusieurs comptes avec rôles différents)
- Application mobile native
- Mode hors-ligne
- Intégration bancaire ou paiement en ligne
- Gestion des notes et bulletins scolaires
- Emploi du temps
- Communication parents-école (SMS, email)

## Contraintes

| Contrainte | Détail |
|-----------|--------|
| Utilisateur unique | Un seul directeur, pas de gestion de rôles |
| Devise | FCFA uniquement |
| Langue | Français uniquement |
| Paiements | Espèces uniquement (pas de mode de paiement en ligne) |
| Hébergement | Self-hosted (serveur de l'école ou VPS) |

## Livrables

| # | Livrable | Description | Statut |
|---|----------|-------------|--------|
| L-01 | Code source | Application Next.js complète | ✅ |
| L-02 | Base de données | Schéma PostgreSQL + migrations Drizzle | ✅ |
| L-03 | Seed | Script de données initiales (niveaux, utilisateur) | ✅ |
| L-04 | Documentation | 16 fichiers de documentation technique | ✅ |
| L-05 | Docker | Dockerfile + Docker Compose | ⏳ |
| L-06 | Guide déploiement | Documentation de mise en production | ⏳ |

## Critères d'acceptation

1. Le directeur peut se connecter avec ses identifiants
2. Il peut créer une année scolaire et la configurer (classes, matières)
3. Il peut inscrire des élèves avec leurs parents/tuteurs
4. Il peut enregistrer des paiements mensuels et voir le suivi par classe
5. Il peut gérer les dépenses et recettes et consulter le bilan
6. Il peut gérer les employés et générer les bulletins de paie mensuels
7. Il peut gérer le transport scolaire (véhicules, itinéraires, affectations)
8. Le tableau de bord affiche les KPIs et graphiques à jour

---

> Ce fichier est la source de vérité pour le contrat du projet CEMAS.
