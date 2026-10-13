# Rapports PDF, frais inclus dans le suivi, blocage d'octobre — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, choisi pour les lots précédents). Steps use checkbox (`- [ ]`) syntax.

**Goal:** suivi lisible (tenue incluse en vert, fournitures masquées hors crèche/préscolaire), « Scolarité octobre » refusée pour les niveaux au forfait, page Rapports avec deux PDF (comptabilité d'une période, rapport de l'établissement).

**Architecture:** règles pures testées (Vitest) + routeurs tRPC en lecture seule + PDF jsPDF côté navigateur (comme reçu et bulletins).

**Tech Stack:** Next.js 16, tRPC 11, Drizzle 0.45, PostgreSQL 16, jsPDF 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-13-rapports-suivi-design.md`

## Global Constraints
- Interface et PDF en français ; montants `formatMontantPdf` (« 70 000 FCFA ») ; en-tête `dessinerEnTeteEcole`.
- Aucune écriture en base de production hors déploiement ; aucune migration dans ce lot.
- Règle du forfait : `estForfait` de `src/modules/finance/impayes.ts` (type « Inscription »).
- Salaires : bulletins `paye = true`, date `COALESCE(date_paiement, 1er jour du mois du bulletin)` (comme le bilan).
- Semaine : lundi → dimanche. Bornes de période incluses.

## Review Focus
1. Semaine à cheval sur deux mois/années (lundi 29 décembre → dimanche 4 janvier) : libellé et bornes justes.
2. Détail comptable long (300 opérations) : pagination sans chevauchement, en-tête de colonnes répété, total final juste.
3. Classe sans aucun paiement de Fourniture en élémentaire : carte masquée ; dès qu'un élève en paie une, carte visible.
4. Élève qui change de niveau en cours d'année : le blocage d'octobre utilise le niveau de la classe actuelle (comme `pourEleve`) — accepté, cas rare.
5. Année scolaire sans transport ni employé : sections du rapport affichées avec « Aucun… », pas d'erreur.

---

### Task 1 : Suivi — frais inclus et cartes masquées

**Files:** Modify `src/modules/finance/suivi-statut.ts`, `src/modules/finance/suivi-statut.test.ts`, `src/modules/finance/router.ts` (`suivi.byClasse`), `src/app/(dashboard)/finances/suivi/page.tsx`, `e2e/15-tarifs.spec.ts`.

**Interfaces — Produces:** `statutFraisUnique(paye: boolean, ctx: { associe: boolean; inscriptionPayee: boolean }): StatutMois` ; `fraisUniqueVisible(ctx: { forfait: boolean; associe: boolean; payeDansClasse: boolean }): boolean` ; `byClasse` : chaque type porte `visible: boolean` et, pour un frais unique, `statut` (« paye » | « inclus » | « impaye »).

- [ ] Tests Vitest (RED) :
```ts
describe("statutFraisUnique", () => {
	it("payé directement", () => expect(statutFraisUnique(true, { associe: true, inscriptionPayee: false })).toBe("paye"));
	it("associé + inscription payée → inclus", () => expect(statutFraisUnique(false, { associe: true, inscriptionPayee: true })).toBe("inclus"));
	it("associé sans inscription → impayé", () => expect(statutFraisUnique(false, { associe: true, inscriptionPayee: false })).toBe("impaye"));
	it("non associé → impayé", () => expect(statutFraisUnique(false, { associe: false, inscriptionPayee: true })).toBe("impaye"));
});
describe("fraisUniqueVisible", () => {
	it("niveau sans forfait : visible", () => expect(fraisUniqueVisible({ forfait: false, associe: false, payeDansClasse: false })).toBe(true));
	it("associé : visible", () => expect(fraisUniqueVisible({ forfait: true, associe: true, payeDansClasse: false })).toBe(true));
	it("non associé sans paiement : masqué", () => expect(fraisUniqueVisible({ forfait: true, associe: false, payeDansClasse: false })).toBe(false));
	it("non associé mais payé dans la classe : visible", () => expect(fraisUniqueVisible({ forfait: true, associe: false, payeDansClasse: true })).toBe(true));
});
```
- [ ] Implémenter dans `suivi-statut.ts` :
```ts
export function statutFraisUnique(paye: boolean, ctx: { associe: boolean; inscriptionPayee: boolean }): StatutMois {
	if (paye) return "paye";
	return ctx.associe && ctx.inscriptionPayee ? "inclus" : "impaye";
}
export function fraisUniqueVisible(ctx: { forfait: boolean; associe: boolean; payeDansClasse: boolean }): boolean {
	return !ctx.forfait || ctx.associe || ctx.payeDansClasse;
}
```
- [ ] `byClasse` : types obligatoires mensuels inchangés ; pour un frais non mensuel et non obligatoire : `associe` = une ligne du forfait du niveau a ce `typeFraisId` ; `inscriptionPayee` = l'élève a un paiement d'un type `estForfait` ; `payeDansClasse` = un élève de la classe a un paiement de ce type ; renvoyer `statut` et `visible` (les frais obligatoires et mensuels : `visible: true`).
- [ ] Page : filtrer `visible` ; un frais unique « inclus » s'affiche comme payé (vert) avec `title="Inclus dans l'inscription"` ; la barre de progression compte payé + inclus.
- [ ] e2e 15 (RED puis GREEN) : classe Élémentaire + élève + paiement Inscription → `byClasse` : Fourniture `visible: false`, Tenue `visible: true` et `statut: "inclus"` ; page : pas de carte « Fourniture », carte « Tenue » à 1/1.
- [ ] Commit `feat(finance): included fees shown as paid in suivi, unrelated cards hidden`.

### Task 2 : Blocage de la « Scolarité octobre »

**Files:** Modify `src/modules/finance/router.ts` (`paiements.create`), `src/app/(dashboard)/finances/paiements/page.tsx`, `e2e/16-reductions.spec.ts`.

- [ ] e2e (RED) : élève Élémentaire ; `finance.paiements.create` Scolarité mois 10 → rejet `/comprise dans le forfait/` ; mois 11 accepté ; UI : élève + Scolarité + Octobre → bouton « Enregistrer le paiement » désactivé et message visible.
- [ ] Serveur, avant la numérotation :
```ts
const [tf] = await ctx.db.select().from(typesFrais).where(eq(typesFrais.id, input.typeFraisId));
if (tf?.mensuel && tf.obligatoire && input.mois === 10) {
	const [forfait] = await ctx.db
		.select({ id: forfaitLignes.id })
		.from(forfaitLignes)
		.innerJoin(classes, eq(classes.niveauId, forfaitLignes.niveauId))
		.innerJoin(eleves, eq(eleves.classeId, classes.id))
		.where(and(eq(eleves.id, input.eleveId), eq(forfaitLignes.anneeScolaireId, input.anneeScolaireId)))
		.limit(1);
	if (forfait) throw new TRPCError({ code: "BAD_REQUEST", message: "La mensualité d'octobre est comprise dans le forfait d'inscription" });
}
```
- [ ] Formulaire : `octobreInclus = typeChoisi?.mensuel && typeChoisi.obligatoire && paymentMois === 10 && tarif.data?.forfait !== null` → bouton désactivé, message en rouge (`text-danger`).
- [ ] Commit `feat(finance): refuse October tuition when included in the forfait`.

### Task 3 : Règles pures des rapports

**Files:** Create `src/modules/reports/periode.ts`, `periode.test.ts`, `comptabilite.ts`, `comptabilite.test.ts`.

**Produces:**
```ts
export type TypePeriode = "jour" | "semaine" | "mois" | "annee";
export function bornesPeriode(type: Exclude<TypePeriode, "annee">, reference: string): { du: string; au: string; libelle: string };
// annee : bornes = date_debut/date_fin de l'année scolaire, libellé « Année scolaire 2026-2027 » (fait par l'appelant)
export type Operation = { date: string; ordre: string; nature: "paiement" | "recette" | "depense" | "salaire"; reference: string; libelle: string; rubrique: string; montant: number };
export function construireComptabilite(ops: Operation[]): {
	encaissements: { rubrique: string; montant: number }[]; totalEncaissements: number;
	recettes: { rubrique: string; montant: number }[]; totalRecettes: number;
	depenses: { rubrique: string; montant: number }[]; totalDepenses: number;
	salaires: { nombre: number; montant: number };
	solde: number; operations: Operation[]; // triées par date puis ordre
};
```
- [ ] Tests (RED) : jour « 2026-10-13 » → du = au, libellé « Mardi 13 octobre 2026 » ; semaine du dimanche 18/10/2026 → 12 au 18 octobre ; semaine du 31/12/2026 → « Semaine du 28 décembre 2026 au 3 janvier 2027 » ; mois « 2027-02-10 » → 2027-02-01 au 2027-02-28, « Février 2027 » ; comptabilité : regroupement par rubrique trié par montant décroissant, solde = enc + rec − dép − sal, tri chronologique, liste vide → tout à 0.
- [ ] Implémenter (dates en UTC via `Date.UTC`, noms des mois depuis `MOIS_LABELS`, jours « Lundi… Dimanche »).
- [ ] Commit `feat(reports): period bounds and accounting summary rules`.

### Task 4 : Routeur `reports`

**Files:** Create `src/modules/reports/service.ts`, `router.ts`; Modify `src/shared/lib/root-router.ts`; Create `e2e/17-rapports.spec.ts`.

**Produces:** `reports.comptabilite({ du, au })` → `ReturnType<typeof construireComptabilite> & { du, au }` ; `reports.etablissement({ anneeScolaireId })` → `{ annee: { libelle, dateDebut, dateFin }, effectifs: { niveau, classe, garcons, filles, total, capacite }[], bilan: { lignes: LigneBilan[], totaux: TotauxBilan }, impayes: { totalDu, totalPaye, totalReste, parClasse: { niveau, classe, reste }[], top: { eleve, classe, reste }[] }, reductions: { parType: { type, nombre }[], montantTotal }, personnel: { parType: { type, nombre }[], masseMensuelle, salairesPayes }, transport: { vehicules: { immatriculation, capacite }[], itineraires: number, eleves: number } }`.
- [ ] e2e (RED) : crée un paiement (élève + Scolarité novembre 12 345), une dépense 4 321 et vérifie que `reports.comptabilite` du jour contient ces deux opérations et que `solde` varie de 12 345 − 4 321 ; `reports.etablissement` de l'année active : `effectifs` contient la classe créée avec 1 élève.
- [ ] Service : requêtes Drizzle (paiements + élève + type ; recettes/dépenses + catégorie ; bulletins payés + employé) → `Operation[]` (paiement : référence = n° de reçu, libellé « Prénom Nom — Scolarité novembre », rubrique = type ; dépense/recette : rubrique = catégorie ; salaire : rubrique « Salaires », référence = matricule employé). `etablissement` réutilise `buildBilanMensuel`/`totauxBilan` (même requête que `finance.bilan`, factorisée si besoin), `getImpayes`, `montantAnnuelReduction` via `finance.reductions.list` (factoriser la logique en fonction serveur `listeReductions(db, anneeId)`).
- [ ] Commit `feat(reports): accounting and school report API`.

### Task 5 : PDF

**Files:** Create `src/shared/lib/generate-rapport-comptable-pdf.ts` (+ test), `generate-rapport-etablissement-pdf.ts` (+ test).

**Produces:** `buildRapportComptablePdf(data, libellePeriode: string, ecole: Parametres): jsPDF`, `buildRapportEtablissementPdf(data, ecole: Parametres): jsPDF`, et `telecharger…` qui appellent `doc.save("rapport-comptable-<du>-<au>.pdf")` / `"rapport-etablissement-<annee>.pdf"`.
- [ ] Tests (RED) : titre, période, totaux et solde présents dans `doc.output()` ; 300 opérations → `getNumberOfPages() > 1`, « Page 1 / N » présent, total final présent ; période vide → « Aucune opération sur la période » ; établissement : les 4 titres de section, « Aucun véhicule » si transport vide.
- [ ] Implémenter : tableau maison (colonnes à largeur fixe, `splitTextToSize` pour le libellé, saut de page à `y > hauteur − 20` avec réimpression de l'en-tête de colonnes), pied « Page n / N » ajouté en fin de génération.
- [ ] Commit `feat(reports): accounting and school report PDFs`.

### Task 6 : Page Rapports

**Files:** Create `src/app/(dashboard)/rapports/page.tsx`; Modify `src/shared/ui/sidebar.tsx` (« Rapports », icône `FileBarChart`, après Paie), `src/app/(dashboard)/page.tsx` (bouton « Rapports » dans l'en-tête) ; e2e 17.
- [ ] e2e (RED) : `/rapports` → choisir « Semaine », cliquer « Télécharger le PDF » de la carte Comptabilité → événement `download` dont le nom commence par `rapport-comptable-` ; carte établissement → `rapport-etablissement-2026-2027.pdf` ; tableau de bord → lien « Rapports » mène à `/rapports`.
- [ ] Page : deux `<section aria-label>` (« Comptabilité », « Rapport de l'établissement ») ; sélecteurs Période (Jour/Semaine/Mois/Année scolaire), date / mois / année scolaire selon le choix ; au clic : `utils.reports.comptabilite.fetch(...)` puis génération et téléchargement ; état « Génération… », erreur affichée.
- [ ] Commit `feat(reports): reports page, sidebar entry and dashboard shortcut`.

### Task 7 : Documentation et vérification
- [ ] `docs/02, 04, 05, 16 (D-023, D-024), 10` mis à jour.
- [ ] typecheck, lint, Vitest, e2e complet sur base neuve (`cemas_ci`, `CI=1 E2E_DESTRUCTIF=1`).
- [ ] Relecture indépendante (opus), corrections RED→GREEN, PR, CI, fusion, déploiement, vérification prod en lecture seule (page Rapports répond, `reports.comptabilite` du jour).
