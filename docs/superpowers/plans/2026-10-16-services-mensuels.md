# Services mensuels et fournitures dans le rapport — plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (exécution inline). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Garderie, Cours de renforcement et Cantine (10 000 FCFA/mois, modifiables) dus pour les élèves abonnés, visibles dans paiements, suivi, impayés ; Fournitures en rubrique à part dans le rapport de comptabilité.

**Architecture:** colonne `types_frais.abonnement` + table `abonnements` ; règles pures (`moisDusAbonnement`, extension de `calculerImpayes`, rubrique `fourniture` de `construireComptabilite`) testées par Vitest ; routeur `finance.abonnements` et `finance.services` (administrateur pour les écritures, journalisées).

**Tech Stack:** Next.js 16, tRPC 11, Drizzle 0.45, PostgreSQL 16, jsPDF 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-16-services-mensuels-design.md`

## Global Constraints
- Mois dus : de `mois_debut` à `min(mois_fin, 6)` dans l'ordre scolaire (10 → 9), limités aux mois échus (`moisDus`).
- Montant d'un service : `types_frais.montant_defaut`, sans réduction ni grille.
- Écritures (abonner, arrêter, reprendre, supprimer, montant) : `adminProcedure` + `journaliser` dans la même transaction ; entités journal `abonnement`, `service`.
- Migration 0013 additive (colonne avec défaut, nouvelle table, CHECK du journal élargi) ; seed : services créés s'ils manquent (par nom).
- Le Dockerfile n'a besoin d'aucun nouveau fichier (le seed n'importe que des schémas existants) — à vérifier par la simulation de démarrage.

## Review Focus
1. Abonnement commencé en novembre, mois courant décembre : seuls novembre et décembre sont dus (pas octobre, pas janvier).
2. Arrêt en février puis « Reprendre » : de nouveau dû jusqu'en juin.
3. Abonnement d'un élève retiré (inactif) : absent des impayés.
4. Mois de fin antérieur au mois de début → refusé avec un message clair.
5. Un paiement de cantine hors abonnement ne crée pas de « reste » négatif ni d'abonnement.

---

### Task 1 : Rapport — rubrique Fournitures
**Files:** `src/modules/reports/comptabilite.ts` (+test), `src/modules/reports/service.ts`, `src/shared/lib/generate-rapport-comptable-pdf.ts` (+test), `src/modules/reports/types.ts`.
- [ ] Vitest (RED) : opérations `fourniture` regroupées dans `fournitures` / `totalFournitures`, absentes de `encaissements` ; `solde` = enc + fournitures + recettes − dépenses − salaires ; PDF contient la section « Fournitures » et le solde inchangé.
- [ ] `NatureOperation` += `fourniture` ; `operationsPeriode` classe les paiements du type nommé « Fourniture » (`TYPE_FOURNITURE`) en `fourniture` ; PDF : section « Fournitures », ligne de synthèse, nature « Fourniture » en entrée.
- [ ] e2e 17 : un paiement Fourniture du jour apparaît dans `fournitures`, pas dans `encaissements`.
- [ ] Commit `feat(reports): supplies reported apart from student receipts`.

### Task 2 : Données et règles des abonnements
**Files:** `src/modules/finance/schema.ts`, `src/modules/audit/schema.ts`, migration 0013, `src/shared/lib/seed.ts`, `src/modules/finance/abonnements.ts` (+test), `src/modules/finance/impayes.ts` (+test).
**Produces:**
```ts
export function moisDusAbonnement(a: { moisDebut: number; moisFin: number | null }, dus: { annee: number; mois: number }[]): { annee: number; mois: number }[];
export const ordreScolaire: (mois: number) => number; // 10→0 … 9→11
// calculerImpayes(p & { services?: FraisInput[]; abonnements?: { eleveId: string; typeFraisId: string; moisDebut: number; moisFin: number | null }[] })
```
- [ ] Vitest (RED) : `moisDusAbonnement` (début novembre/courant décembre → nov, déc ; fin février → s'arrête ; juin dernier ; début après le mois courant → rien) ; `calculerImpayes` : abonné cantine non payé → « Cantine » en impayé au montant du service, sans réduction même si l'élève a une réduction « les deux » ; mois payé soldé ; paiement hors abonnement sans effet sur le reste.
- [ ] Schéma : `typesFrais.abonnement`, table `abonnements` (CHECK mois 1–12, unique), CHECK journal élargi ; migration générée et relue ; seed des 3 services.
- [ ] Commit `feat(finance): subscription services data and arrears rules`.

### Task 3 : API
**Files:** `src/modules/finance/router.ts` (ou `abonnements-router.ts`), `validation.ts`, `impayes-service.ts`, `suivi-statut.ts` (+test).
- [ ] e2e `20-services.spec.ts` (RED, API) : `finance.services.list` (3 services, 10 000) ; `finance.abonnements.abonner({ eleveId, typeFraisId, moisDebut })` → impayés « Cantine » ; paiement du mois → soldé ; `arreter({ moisFin })` (fin < début refusée) ; `reprendre` ; `supprimer` refusé s'il existe un paiement du service ; `services.modifierMontant` (admin) → `pourEleve.services` propose le nouveau montant ; un non-administrateur est refusé ; journal écrit.
- [ ] `getImpayes` charge services + abonnements de l'année ; `pourEleve` renvoie `services: { typeFraisId, nom, montant, abonne: boolean, moisDebut, moisFin }[]` ; `suivi.byClasse` : statut d'un mois de service = `paye` | `impaye` (dû) | `non_du` (hors abonnement) et `visible` si abonné ou payé dans la classe (`statutService`, testé).
- [ ] `finance.abonnements.listParService({ anneeScolaireId })` : abonnés, classe, mois, payés/dus.
- [ ] Commit `feat(finance): subscription API, arrears, suivi and payment hints`.

### Task 4 : Interface
**Files:** `src/modules/finance/components/services-eleve.tsx`, `src/app/(dashboard)/eleves/[id]/page.tsx`, `src/app/(dashboard)/finances/services/page.tsx`, `src/shared/ui/sidebar.tsx`, `src/app/(dashboard)/finances/paiements/page.tsx`, `src/app/(dashboard)/finances/suivi/page.tsx`.
- [ ] e2e 20 (RED, UI) : fiche élève → section « Services » → « S'abonner » Cantine (Novembre) → « Abonné depuis Novembre » ; « Arrêter » (Février) → « Abonné de Novembre à Février » ; page Services : montant modifié, abonné listé ; saisie : option « Cantine — 10 000 » et avertissement « non abonné » pour un autre élève ; suivi : grille « Cantine » avec « — » en octobre.
- [ ] Implémenter (boutons d'écriture visibles pour l'administrateur ; rafraîchissement impayés/tableau de bord).
- [ ] Commit `feat(finance): services section, services page, payment and suivi display`.

### Task 5 : Documentation, vérification, livraison
- [ ] `docs/02, 03, 04, 05, 16 (D-027), 10`.
- [ ] typecheck, lint, Vitest, e2e complet sur base neuve, simulation du démarrage de l'image (seed).
- [ ] Relecture indépendante (opus), corrections RED→GREEN, PR, CI, fusion, déploiement, vérification prod en lecture seule (services créés, migration 0013).
