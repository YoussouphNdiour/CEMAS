# 10 - Problèmes connus

Mis à jour le 2026-10-09.

## Sécurité (à traiter en priorité)

| # | Sévérité | Description | Action |
|---|----------|-------------|--------|
| S1 | **Critique** | `AUTH_SECRET` en production = valeur par défaut de `docker-compose.yml`, visible dans le dépôt public : n'importe qui peut forger une session | Définir un `AUTH_SECRET` aléatoire dans les variables de la stack Portainer et retirer la valeur par défaut du dépôt (déconnecte les sessions) |
| S2 | Élevée | Mot de passe PostgreSQL et SMTP en clair dans `docker-compose.yml` (dépôt public) | Variables d'environnement Portainer |
| S3 | Élevée | Mot de passe du compte admin créé par le seed connu (dans le code) | Le changer en production |
| S4 | Moyenne | Jeton GitHub et clé API Portainer partagés dans une conversation de travail | Les révoquer, régénérer, mettre à jour le secret GitHub `PORTAINER_API_KEY` |
| S5 | Moyenne | Portainer joint en HTTPS avec certificat auto-signé (`curl -k` dans le déploiement) | Certificat valide |

## Points reportés (relectures de code)

### Paramètres (lot 1)
- Le bouton de téléchargement du reçu ne fait rien si les paramètres ne sont pas chargés
- `PrintLayout` n'est utilisé par aucune page
- Préfixe de 10 caractères + 10 000e identifiant d'une année : dépasse `varchar(20)`
- Deux créations simultanées peuvent calculer le même numéro (l'une échoue, à relancer)
- Conversion `::int` : échec si un identifiant contient un numéro de 11 chiffres
- Email de l'établissement sans longueur max côté validation

### Impayés et grille (lot 2)
- Vider une case déjà enregistrée de la grille n'a aucun effet
- `upsertMany` ne vérifie pas que classes/frais appartiennent à l'année et sont obligatoires
- La lettre de relance n'a pas de saut de page (tient sur une page aujourd'hui)
- Les cartes « Élèves » et « Impayés » du tableau de bord ne comptent pas exactement le même ensemble
- Élève inscrit en cours d'année : ses mois dus partent d'octobre (décision produit à prendre)
- ~~149 élèves sans scolarité d'octobre~~ : résolu (octobre inclus dans le forfait d'inscription, D-021)

### Passage d'année (lot 4)
- Dates de la nouvelle année non validées côté serveur (format, début < fin, 29 février)
- Pas d'alerte en quittant l'assistant en cours de route ; étape 2 sans classe → message brut
- La configuration des classes de l'année cible est remplacée par celle de l'année recopiée
- `classes.update` vérifie la classe suivante hors transaction (sans effet pratique)
- Le test e2e destructif ne vérifie pas la base ciblée (`E2E_DESTRUCTIF` seul)
- Retour arrière en cas d'erreur au milieu du passage : non testé automatiquement (repose sur la transaction)

### Encadrement du passage (lot 4b)
- `executer` recalcule les impayés pour rien ; la page Années charge tout le contexte du passage pour un libellé
- « Décisions enregistrées » reste affiché après de nouvelles modifications ; pas d'enregistrement automatique
- Le test 14c dépend de l'ordre et de `PASSAGE_AUJOURDHUI` ; le test 13 efface les décisions enregistrées de la base de dev
- Ajouter `USER nextjs` au Dockerfile rendrait `/backups` non inscriptible ; modifier la date de fin ouvre la fenêtre ; « Faire une sauvegarde maintenant » sans limite de fréquence

### Général
- `scripts/entrypoint.sh` masque les erreurs de migration (`2>/dev/null || echo …`)
- Aucune vérification de rôle : tout compte connecté peut tout faire (dont le passage d'année)

### Tableau de bord
- `dashboard.stats.totalDepenses` additionne les dépenses de toutes les années

## Limitations connues

- Paiements partiels non suivis (un mois payé est soldé, décision D-016)
- Remises par élève non gérées
- Pas d'upload de photo élève (`photo_url` sans interface)
- Pas de calcul des charges sociales en paie
- Transport : capacité du véhicule non contrôlée, affectations à refaire chaque année
- Pas de notifications (email, SMS) — rappels du passage d'année par bandeaux uniquement (décision D-020)
- Sauvegardes sur le même serveur que la base (pas de copie hors serveur)
- Pas de logs d'audit, pas de mode hors ligne
- 90 avertissements Biome historiques (libellés de formulaires non associés, boutons sans `type`…)
- GitHub Actions : actions `checkout`/`setup-node`/`pnpm` sur Node 20 (dépréciation annoncée)

## Problèmes résolus

| Date | Module | Description | Résolution |
|------|--------|-------------|------------|
| 2026-09-30 | Finance | Prop `actions` inexistante sur DataTable | Colonne avec `render` |
| 2026-09-30 | Dashboard | Type Recharts Tooltip formatter | Cast `Number(value)` |
| 2026-09-30 | Paramètres | Imports inutilisés | Suppression |
| 2026-09-30 | Payroll | Pages dupliquées `/paie/` et `/payroll/` | Conservation de `/payroll/` |
| 2026-10-09 | Général | « CEMAS » codé en dur à 11 endroits | Table `parametres_ecole` (lot 1) |
| 2026-10-09 | Finance | Numéro de reçu : `MAX` texte global + `split` | Séquence numérique par préfixe/année |
| 2026-10-09 | Finance | Bilan sans salaires, dépenses/recettes non filtrées | Bilan net des salaires par année (lot 6) |
| 2026-10-09 | Finance | Pas de PDF de relance ni d'impayés | Lot 2 |
| 2026-10-09 | Paie | Pas de PDF des bulletins | Lot 3 |
| 2026-10-09 | Général | Pas de sauvegarde automatique | Service `backup` (lot 5) |
| 2026-10-09 | Outils | `pnpm lint` cassé (config Biome 2.0 / CLI 2.5) | Config migrée |
| 2026-10-09 | Tests | Tests e2e non versionnés, sélecteurs fragiles, 10+ exclus de la CI | Suite versionnée, motif CI corrigé |
| 2026-10-09 | Académique | `classes.list` sans ordre (tests instables) | Tri niveau puis nom |

---

> Ce fichier est la source de vérité pour les problèmes connus du projet.
| 2026-10-10 | Finance | Points mineurs de la relecture du forfait (M1–M9) | Fournitures plafonnées au montant des lignes, reste dû proposé à la saisie (« Forfait déjà soldé »), messages clairs sur la page Tarifs, total des réductions avec repli sur la grille, contrôles CHECK sur `reductions`, cascade des tarifs avec le niveau, en-têtes du suivi au tarif du niveau, tableau de bord rafraîchi après une réduction |
