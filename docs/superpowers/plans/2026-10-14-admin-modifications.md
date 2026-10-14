# Modifier et supprimer (administrateur) avec journal — plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (exécution inline, comme les lots précédents). Steps use checkbox (`- [ ]`) syntax.

**Goal:** l'administrateur modifie et supprime élèves, contacts, paiements et employés depuis l'application, dans les limites décidées, avec un journal consultable.

**Architecture:** `adminProcedure` (rôle lu en base) ; table `journal_modifications` écrite dans la même transaction que chaque action ; fonctions pures testées (différences avant/après, normalisation des noms) ; dialogues réutilisables côté interface.

**Tech Stack:** Next.js 16, tRPC 11, Drizzle 0.45, PostgreSQL 16, zod 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-14-admin-modifications-design.md`

## Global Constraints
- Administrateur : `users.role` ∈ {`directeur`, `admin`} ; refus `FORBIDDEN` « Action réservée à l'administrateur ».
- Journal dans la même transaction ; rien n'est écrit si aucun champ ne change.
- Motif obligatoire (1 à 300 caractères) pour modifier ou supprimer un paiement.
- Numéros de reçu jamais réutilisés ni modifiés.
- Migration 0012 additive (nouvelle table) ; aucune donnée existante modifiée.
- Interface en français ; messages d'erreur métier en clair (pas d'« erreur inattendue » pour un cas prévu).

## Review Focus
1. Paiement modifié vers un mois déjà payé du même type → message clair citant le reçu existant, rien n'est modifié.
2. Élève déplacé vers une classe d'une autre année → refusé.
3. Suppression d'un élève dont le parent est partagé avec un frère ou une sœur → le parent reste.
4. Utilisateur non administrateur qui appelle directement l'API → `FORBIDDEN` (pas seulement des boutons cachés).
5. Modification d'un élève vers les nom/prénom/date de naissance d'une autre fiche de l'année → refusée ; modification de la même fiche sans changer le nom → acceptée.

---

### Task 1 : Socle — rôle, journal, différences

**Files:** Modify `src/shared/lib/trpc.ts`, `src/modules/settings/router.ts` ; Create `src/modules/audit/schema.ts`, `src/modules/audit/journal.ts`, `src/modules/audit/journal.test.ts`, `src/modules/students/noms.ts`, `src/modules/students/noms.test.ts` ; migration `drizzle/migrations/0012_*.sql` ; schéma exporté dans l'index Drizzle.

**Produces:**
```ts
export const adminProcedure; // ctx.session.user + ctx.admin: { id: string; nom: string }
export function differences(avant: Record<string, unknown>, apres: Record<string, unknown>): { avant: Record<string, unknown>; apres: Record<string, unknown> } | null; // champs modifiés seulement, null si aucun
export async function journaliser(tx, entree: { userId: string; userNom: string; entite: "eleve" | "contact" | "paiement" | "employe"; entiteId: string; action: "modification" | "suppression"; libelle: string; avant: unknown; apres: unknown | null; motif?: string | null }): Promise<void>;
export function normaliserNom(v: string): string; // NFC, espaces/tabulations/insécables → une espace, trim, minuscules
export const nomNormaliseSql: (col) => SQL; // lower(trim(regexp_replace(col, '[\s' || chr(160) || ']+', ' ', 'g')))
// settings.moi → { nom: string; estAdmin: boolean }
```
- [ ] Vitest (RED) : `differences({a:1,b:2},{a:1,b:3})` → `{avant:{b:2},apres:{b:3}}` ; identiques → `null` ; `null` vs `""` considérés égaux pour les champs facultatifs ; `normaliserNom("  Awa \tBINETA ")` → `"awa bineta"`.
- [ ] Implémenter ; `students.create` réutilise `normaliserNom`/`nomNormaliseSql` (comportement inchangé, e2e 18 vert).
- [ ] Table `journal_modifications` (colonnes et CHECK de la spec § 4), migration générée et relue.
- [ ] `adminProcedure` : lit `users.role`/`nom` par `session.user.id` ; `settings.moi`.
- [ ] e2e `19-admin.spec.ts` (RED) : en base jetable, le test insère par SQL un utilisateur `secretaire` (mot de passe haché bcrypt) ; connecté avec ce compte, `settings.moi.estAdmin === false` et `students.update` → `FORBIDDEN` ; le directeur → `estAdmin === true`.
- [ ] Commit `feat(admin): admin procedure, audit log table and helpers`.

### Task 2 : Élèves et contacts

**Files:** Modify `src/modules/students/router.ts`, `validation.ts`, `src/app/(dashboard)/eleves/[id]/page.tsx` ; Create `src/modules/students/components/modifier-eleve.tsx`, `retirer-eleve.tsx`, `modifier-contact.tsx` ; e2e 19.

- [ ] e2e (RED) :
  - modifier prénom, nom et classe d'un élève → fiche à jour, `inscriptions` de l'année sur la nouvelle classe (via `students.getById` / suivi de la classe), journal contient « classe : X → Y » ;
  - modifier vers l'identité d'une autre fiche de l'année → `CONFLICT` avec son matricule ; enregistrer sans changer le nom → accepté ;
  - classe d'une autre année → refusé ;
  - supprimer un élève avec paiement → refus « utilisez “Retirer de l'école” » ; sans paiement → supprimé, parent seul supprimé, parent partagé conservé ;
  - retirer (Transféré) puis réintégrer ; modifier le nom d'un parent (contact).
- [ ] `students.update` → `adminProcedure`, transaction : lecture avant, doublon (exclure `id`), classe de la même année, mise à jour élève + `inscriptions.classe_id`, `journaliser` (classe en clair : nom de classe avant/après). Retour `{ eleve, niveauChange: boolean, niveauNom }`.
- [ ] `students.updateParent({ parentId, eleveId, ...champs })` (administrateur) + journal `contact` ; renvoie `partage: number` (nombre d'enfants liés).
- [ ] `students.delete` → `adminProcedure` : refus si paiements ; sinon suppression des dépendances (transport, réductions, décisions de passage, inscriptions, liens parents), élève, parents orphelins ; journal (ligne entière).
- [ ] Interface (boutons visibles si `settings.moi.estAdmin`) : « Modifier » (FormModal, champs de la spec), « Retirer de l'école » / « Réintégrer », « Supprimer » (ConfirmDialog ; le message de refus s'affiche), « Modifier » par contact ; bandeau d'information si `niveauChange`.
- [ ] Commit `feat(students): admin edit, withdraw and delete with audit log`.

### Task 3 : Paiements

**Files:** Modify `src/modules/finance/router.ts`, `validation.ts`, `src/app/(dashboard)/finances/paiements/page.tsx`, `src/app/(dashboard)/eleves/[id]/page.tsx` ; Create `src/modules/finance/components/modifier-paiement.tsx`, `supprimer-paiement.tsx` ; e2e 19.

- [ ] e2e (RED) : modifier montant et mois (sans motif → refus ; avec motif → OK, reçu `getRecuData` à jour, journal) ; vers un mois déjà payé → « Ce mois est déjà payé pour ce type (reçu REC-…) » ; vers octobre pour un niveau au forfait → refus D-024 ; supprimer sans motif → refus, avec motif → supprimé et journalisé ; UI : boutons dans la liste du mois et dans la section « Paiements » de la fiche élève.
- [ ] Extraire la règle d'octobre de `paiements.create` dans `verifierOctobre(db, eleveId, typeFraisId, anneeScolaireId, mois)` (réutilisée).
- [ ] `paiements.update({ id, typeFraisId, mois, montant, datePaiement, motif })` et `paiements.delete({ id, motif })` (administrateur, transaction, journal ; libellé « REC-… — Prénom Nom »).
- [ ] Fiche élève : section « Paiements (année active) » (`listByEleve`) avec reçu, type, mois, montant, date et actions.
- [ ] Commit `feat(finance): admin edit and delete of payments with mandatory reason`.

### Task 4 : Employés

**Files:** Modify `src/modules/payroll/router.ts`, `src/app/(dashboard)/payroll/employes/page.tsx` ; e2e 19.

- [ ] e2e (RED) : supprimer un employé avec bulletin → refus « désactivez-le » ; « Désactiver » puis « Réactiver » ; supprimer un employé sans bulletin → OK ; journal.
- [ ] `employes.update` / `delete` → `adminProcedure` + journal ; `delete` refusé si bulletins ; `employes.changerStatut({ id, statut })` (ou `update` avec statut).
- [ ] Page : boutons visibles pour l'administrateur ; « Désactiver/Réactiver » ; message de refus affiché.
- [ ] Commit `feat(payroll): admin edit, deactivate and guarded delete of employees`.

### Task 5 : Page Journal

**Files:** Create `src/modules/audit/router.ts` (`audit.list({ entite?, du?, au?, page })`, administrateur), `src/app/(dashboard)/parametres/journal/page.tsx` ; lien depuis Paramètres ; e2e 19.
- [ ] e2e (RED) : après les actions des tâches 2-4, la page Journal liste les lignes (libellé, action, « montant : 20 000 → 18 000 », motif) ; filtre « Paiements ».
- [ ] Commit `feat(admin): audit log page`.

### Task 6 : Documentation, vérification, livraison
- [ ] `docs/02, 03, 04, 05, 16 (D-026), 10`.
- [ ] typecheck, lint, Vitest, e2e complet sur base neuve (`CI=1 E2E_DESTRUCTIF=1`).
- [ ] Relecture indépendante (opus), corrections RED→GREEN, PR, CI, fusion, déploiement, vérification prod en lecture seule (migration 0012 appliquée, page Journal répond).
