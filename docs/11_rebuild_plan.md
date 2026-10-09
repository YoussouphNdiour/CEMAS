# 11 - Plan de développement

## Phases réalisées

### Phase 0 : Fondations ✅ (2026-09-30)
- [x] Next.js + TypeScript, Tailwind CSS v4, Drizzle + PostgreSQL, Auth.js v5, tRPC v11
- [x] Composants UI partagés, layout avec sidebar, Biome

### Phase 1 : Modules métier ✅
- [x] Académique, Élèves, Finances, Paie, Transport

### Phase 2 : Tableau de bord et paramètres ✅

### Phase 3 : Déploiement ✅
- [x] Dockerfile multi-stage, Docker Compose, stack Portainer (Git, branche `main`)
- [x] Migrations et seed au démarrage (`scripts/entrypoint.sh`)

### Phase 4 : Améliorations issues de la version Excel ✅ (2026-10-09)
Source : `17_prompt_ameliorations_web.md`. Chaque lot : spec → plan → implémentation TDD → relecture → PR → CI → déploiement.

| Lot | Contenu | PR |
|-----|---------|----|
| 1 | Paramètres de l'école configurables, produit « Gestion Ecole » | #1 |
| — | CI/CD GitHub Actions + déploiement Portainer, lint réparé, e2e versionnés | #2 |
| 6 | Bilan incluant les salaires, détail mensuel (Vitest ajouté) | #3 |
| 7 | Capacité des classes | #4 |
| 8 | Second contact parent | #5 |
| 2 | Grille tarifaire, impayés, lettres de relance | #6 |
| — | Correctif CI (ordre des classes, e2e 10+) | #7 |
| 3 | Fiches de paie PDF | #8 |
| 5 | Sauvegarde quotidienne | #9 |
| 4 | Passage à l'année suivante | #10 |

---

## Phases à venir

### Phase 5 : Sécurité (prioritaire)
- [ ] `AUTH_SECRET` et mots de passe en variables d'environnement Portainer (voir `10_current_issues.md` S1–S3)
- [ ] Rotation des jetons partagés (S4)

### Phase 6 : Encadrement du passage d'année (lot 4b) ✅
- [x] Passage autorisé seulement après la date de fin de l'année active
- [x] Contrôles avant passage : sauvegarde < 24 h, sauvegarde automatique juste avant, impayés restants, checklist
- [x] Décisions de passage enregistrées entre juin et août
- [x] Bandeaux de rappel sur le tableau de bord (à partir du 15 juin et après la date de fin)

### Phase 7 : Points reportés
- [ ] Voir `10_current_issues.md` (relectures des lots 1, 2, 4)
- [ ] Copie des sauvegardes hors du serveur

### Phase 8 : Améliorations P2
- [ ] Remises par élève, paiements partiels
- [ ] Upload de photo élève
- [ ] Logs d'audit
- [ ] Validation de la capacité des véhicules

---

> Ce fichier est la source de vérité pour le plan de développement du projet.
