# 04 - Spécification API

## Architecture

L'API CEMAS utilise **tRPC v11** avec un routeur racine (`appRouter`) composé de 6 sous-routeurs de module. Toutes les procédures sont protégées (`protectedProcedure`) et nécessitent une session Auth.js valide.

```
appRouter
├── academic
│   ├── niveaux
│   ├── annees
│   ├── classes
│   └── matieres
├── students
├── finance
│   ├── typesFrais
│   ├── grilleFrais
│   ├── paiements
│   ├── suivi
│   ├── depenses
│   ├── recettes
│   └── bilan
├── payroll
│   ├── employes
│   ├── bulletins
│   └── historique
├── transport
│   ├── vehicules
│   ├── itineraires
│   ├── arrets
│   └── affectations
└── dashboard
```

## Contexte tRPC

```typescript
createTRPCContext = async () => {
  const session = await auth();
  return { db, session };
};
```

Le middleware `protectedProcedure` vérifie `ctx.session?.user` et renvoie `UNAUTHORIZED` si absent.

---

## Module Académique (`academic`)

### `academic.niveaux.list`
- **Type :** Query
- **Input :** aucun
- **Output :** `Niveau[]` (id, nom, ordre)
- **Tri :** par ordre

### `academic.annees.list`
- **Type :** Query
- **Input :** aucun
- **Output :** `AnneeScolaire[]`
- **Tri :** par dateDebut DESC

### `academic.annees.create`
- **Type :** Mutation
- **Input :** `{ libelle: string, dateDebut: string, dateFin: string }`
- **Output :** `AnneeScolaire`

### `academic.annees.update`
- **Type :** Mutation
- **Input :** `{ id: uuid, libelle?: string, dateDebut?: string, dateFin?: string }`
- **Output :** `AnneeScolaire`

### `academic.annees.delete`
- **Type :** Mutation
- **Input :** `{ id: uuid }`
- **Output :** `{ success: true }`

### `academic.annees.setActive`
- **Type :** Mutation
- **Input :** `{ id: uuid }`
- **Description :** Désactive toutes les années puis active celle spécifiée (transaction)
- **Output :** `{ success: true }`

### `academic.classes.list`
- **Type :** Query
- **Input :** `{ anneeScolaireId?: uuid, niveauId?: uuid }` (optionnel)
- **Output :** `Classe[] with { niveau, effectif, placesRestantes }` — `effectif` = élèves `actif` de la classe ; `placesRestantes = capacite − effectif` (négatif en cas de dépassement)

### `academic.classes.create`
- **Type :** Mutation
- **Input :** `{ nom: string, niveauId: uuid, capacite: number, anneeScolaireId: uuid }`
- **Output :** `Classe`

### `academic.classes.update`
- **Type :** Mutation
- **Input :** `{ id: uuid, nom?: string, capacite?: number, classeSuivanteId?: uuid | null, finDeCycle?: boolean }`
- **Output :** `Classe`
- **Erreurs :** `BAD_REQUEST` si la classe suivante n'est pas une autre classe de la même année ; `finDeCycle = true` remet `classeSuivanteId` à null

### `academic.passage.contexte`
- **Type :** Query
- **Output :** `{ source: Annee, proposition: { libelle, dateDebut, dateFin }, classes: (Classe & { niveauNom })[], eleves: { id, prenom, nom, matricule, classeId }[] }` (année active)

### `academic.passage.configurerClasses`
- **Type :** Mutation
- **Input :** `{ classes: { id, classeSuivanteId: uuid | null, finDeCycle: boolean }[] }` (classes de l'année active)
- **Output :** `{ count }`

### `academic.passage.preview`
- **Type :** Query
- **Input :** `{ decisions: Record<eleveId, "passe" | "redouble" | "quitte"> }` (absent = passe)
- **Output :** `{ erreurs, mouvements, parClasse, effectifsPrevus }` — sans écriture

### `academic.passage.executer`
- **Type :** Mutation
- **Input :** `{ cible: { libelle, dateDebut, dateFin }, decisions }`
- **Description :** Transaction unique (voir `02_features.md`) ; refus `BAD_REQUEST` si une classe n'est pas configurée, une décision vise un élève non concerné, ou la cible est l'année active
- **Output :** `{ anneeId, promus, redoublants, sortants, departs, classesCreees, grilleCopiee }`

### `academic.classes.delete`
- **Type :** Mutation
- **Input :** `{ id: uuid }`
- **Output :** `{ success: true }`

### `academic.matieres.list`
- **Type :** Query
- **Input :** `{ niveauId?: uuid }` (optionnel)
- **Output :** `Matiere[] with { niveau }`

### `academic.matieres.create`
- **Type :** Mutation
- **Input :** `{ nom: string, coefficient: number, niveauId: uuid }`
- **Output :** `Matiere`

### `academic.matieres.update`
- **Type :** Mutation
- **Input :** `{ id: uuid, nom?: string, coefficient?: number }`
- **Output :** `Matiere`

### `academic.matieres.delete`
- **Type :** Mutation
- **Input :** `{ id: uuid }`
- **Output :** `{ success: true }`

---

## Module Élèves (`students`)

### `students.list`
- **Type :** Query
- **Input :** `{ anneeScolaireId: uuid, classeId?: uuid, niveauId?: uuid, statut?: string, search?: string }`
- **Output :** `StudentRow[]` (id, matricule, prenom, nom, dateNaissance, sexe, statut, classeNom, niveauNom)
- **Note :** Recherche appliquée en JS sur prénom, nom, matricule

### `students.getById`
- **Type :** Query
- **Input :** `{ id: uuid }`
- **Output :** `Student & { parents: (Parent & { principal: boolean })[] }` — contact principal en premier
- **Erreur :** Throw si élève non trouvé

### `students.create`
- **Type :** Mutation
- **Input :** `createStudentSchema` — données élève + `parent` (contact principal) + `parent2` optionnel (même schéma `parentSchema`)
- **Description :** Transaction : génère matricule → insère élève → insère et lie le contact principal (`principal = true`) puis le 2e contact (`principal = false`) → crée inscription
- **Output :** `Eleve`

### `students.addParent`
- **Type :** Mutation
- **Input :** `{ eleveId: uuid, parent: parentSchema }`
- **Description :** Ajoute le 2e contact d'un élève existant (principal si l'élève n'en avait aucun)
- **Erreurs :** `NOT_FOUND` élève inconnu ; `BAD_REQUEST` « Cet élève a déjà 2 contacts. »

### `students.update`
- **Type :** Mutation
- **Input :** `{ id: uuid, prenom?, nom?, dateNaissance?, lieuNaissance?, sexe?, adresse?, classeId?, statut? }`
- **Output :** `Eleve`

### `students.delete`
- **Type :** Mutation
- **Input :** `{ id: uuid }`
- **Output :** `{ success: true }`

### `students.count`
- **Type :** Query
- **Input :** `{ anneeScolaireId: uuid }`
- **Output :** `{ total: number, byNiveau: Record<string, number> }`

---

## Module Finances (`finance`)

### `finance.typesFrais.list`
- **Type :** Query
- **Output :** `TypeFrais[]` trié par nom

### `finance.grilleFrais.list`
- **Type :** Query
- **Input :** `{ anneeScolaireId: uuid }`
- **Output :** `GrilleFrais[] with classeNom, typeFraisNom`

### `finance.grilleFrais.upsert`
- **Type :** Mutation
- **Input :** `{ classeId: uuid, typeFraisId: uuid, anneeScolaireId: uuid, montantMensuel: number }`
- **Description :** Crée ou met à jour la grille tarifaire

### `finance.grilleFrais.upsertMany`
- **Type :** Mutation
- **Input :** `{ anneeScolaireId: uuid, cellules: { classeId, typeFraisId, montant }[] }` — 1 à 200 cellules, montant entier ≥ 0
- **Description :** Crée ou met à jour plusieurs cellules dans une transaction
- **Output :** `{ count: number }`

### `finance.impayes.list`
- **Type :** Query
- **Input :** `{ anneeScolaireId: uuid, classeId?: uuid, niveauId?: uuid }`
- **Output :** `{ lignes: LigneImpaye[], totalDu, totalPaye, totalReste, classesMontantDefaut: { classeId, classeNom, frais: string[] }[] }`
- `LigneImpaye` : élève (`id, matricule, prenom, nom, classeId, classeNom, niveauId, telephone, parentNom`) + `du, paye, reste, moisImpayes: { typeFraisId, typeFraisNom, mois|null, annee|null, montant }[]` ; seulement `reste > 0`, tri par reste décroissant

### `finance.paiements.create`
- **Type :** Mutation
- **Input :** `{ eleveId: uuid, typeFraisId: uuid, anneeScolaireId: uuid, mois: 1-12, montant: number }`
- **Description :** Auto-génère le numéro de reçu `REC-{année}-{seq}`

### `finance.paiements.listByEleve`
- **Type :** Query
- **Input :** `{ eleveId: uuid, anneeScolaireId: uuid }`
- **Output :** `Paiement[] with typeFraisNom`

### `finance.paiements.listByMonth`
- **Type :** Query
- **Input :** `{ anneeScolaireId: uuid, mois: 1-12 }`
- **Output :** `Paiement[] with elevePrenom, eleveNom, eleveMatricule, typeFraisNom`

### `finance.suivi.byClasse`
- **Type :** Query
- **Input :** `{ classeId: uuid, anneeScolaireId: uuid }`
- **Output :** Tableau d'élèves avec pour chaque type de frais, un tableau de 10 mois (Oct-Jul) avec statut payé/non payé
- **Description :** Construit une lookup map `eleveId → typeFraisId → Set<mois>` pour performance

### `finance.depenses.list`
- **Type :** Query
- **Output :** `Depense[] with categorieNom` trié par date DESC

### `finance.depenses.create`
- **Type :** Mutation
- **Input :** `{ categorieId: uuid, libelle: string, montant: number, date: string, note?: string }`

### `finance.depenses.delete`
- **Type :** Mutation
- **Input :** `{ id: uuid }`

### `finance.depenses.categories`
- **Type :** Query
- **Output :** `CategorieDepense[]`

### `finance.recettes.list`
- **Type :** Query
- **Output :** `Recette[] with categorieNom` trié par date DESC

### `finance.recettes.create`
- **Type :** Mutation
- **Input :** `{ categorieId: uuid, libelle: string, montant: number, date: string, note?: string }`

### `finance.recettes.delete`
- **Type :** Mutation
- **Input :** `{ id: uuid }`

### `finance.recettes.categories`
- **Type :** Query
- **Output :** `CategorieRecette[]`

### `finance.bilan.summary`
- **Type :** Query
- **Input :** `{ anneeScolaireId: uuid }`
- **Output :** `{ totalPaiements, totalRecettes, totalDepenses, totalSalaires, solde, mois: LigneBilan[] }`
- `LigneBilan` : `{ annee, mois, paiements, recettes, depenses, salaires, solde, soldeCumule }` (vue trésorerie, ordre chronologique)
- **Calcul :** `src/modules/finance/bilan.ts` (`buildBilanMensuel`, `totauxBilan`, testés par Vitest). Les totaux sont la somme des lignes.
- **Erreurs :** `NOT_FOUND` si l'année scolaire n'existe pas

---

## Module Paie (`payroll`)

### `payroll.employes.list`
- **Type :** Query
- **Output :** `Employe[] with bulletinsCount` trié par nom

### `payroll.employes.create`
- **Type :** Mutation
- **Input :** `{ prenom, nom, telephone?, poste, type: enseignant|administratif|entretien, salaireBase, dateEmbauche }`
- **Description :** Auto-génère matricule `EMP-{seq}`

### `payroll.employes.update`
- **Type :** Mutation
- **Input :** `{ id: uuid, prenom?, nom?, telephone?, poste?, type?, salaireBase?, dateEmbauche? }`

### `payroll.employes.delete`
- **Type :** Mutation
- **Input :** `{ id: uuid }`

### `payroll.bulletins.list`
- **Type :** Query
- **Input :** `{ mois: 1-12, annee: number }`
- **Output :** `Bulletin[] with employeMatricule, employePrenom, employeNom, employePoste`

### `payroll.bulletins.generate`
- **Type :** Mutation
- **Input :** `{ mois: 1-12, annee: number }`
- **Description :** Crée un bulletin par employé actif qui n'en a pas encore pour ce mois
- **Output :** `{ created: number, message: string }`

### `payroll.bulletins.update`
- **Type :** Mutation
- **Input :** `{ id: uuid, primes: number, retenues: number, note?: string }`
- **Description :** Recalcule net = salaireBase + primes - retenues

### `payroll.bulletins.markPaid`
- **Type :** Mutation
- **Input :** `{ id: uuid }`
- **Description :** Met `paye = true` et `datePaiement = today`

### `payroll.bulletins.stats`
- **Type :** Query
- **Input :** `{ mois: 1-12, annee: number }`
- **Output :** `{ totalNet, totalPrimes, totalRetenues, nbEmployes }`

### `payroll.historique`
- **Type :** Query (procédure directe, pas de sous-routeur)
- **Input :** `{ annee: number }`
- **Output :** Tableau de 12 mois avec `{ mois, totalBase, totalPrimes, totalRetenues, totalNet, nbPayes }`

---

## Module Transport (`transport`)

### `transport.vehicules.list`
- **Type :** Query
- **Output :** `Vehicule[]` trié par marque

### `transport.vehicules.create`
- **Type :** Mutation
- **Input :** `{ immatriculation, marque?, capacite, chauffeurNom, chauffeurTel }`

### `transport.vehicules.update`
- **Type :** Mutation
- **Input :** `{ id: uuid, immatriculation?, marque?, capacite?, chauffeurNom?, chauffeurTel? }`

### `transport.vehicules.delete`
- **Type :** Mutation
- **Input :** `{ id: uuid }`

### `transport.itineraires.list`
- **Type :** Query
- **Output :** `Itineraire[] with vehiculeImmatriculation, vehiculeMarque, arretsCount`

### `transport.itineraires.create`
- **Type :** Mutation
- **Input :** `{ nom, vehiculeId?, description? }`

### `transport.itineraires.update`
- **Type :** Mutation
- **Input :** `{ id: uuid, nom?, vehiculeId?, description? }`

### `transport.itineraires.delete`
- **Type :** Mutation
- **Input :** `{ id: uuid }`

### `transport.arrets.listByItineraire`
- **Type :** Query
- **Input :** `{ itineraireId: uuid }`
- **Output :** `Arret[]` trié par ordre

### `transport.arrets.create`
- **Type :** Mutation
- **Input :** `{ itineraireId: uuid, nom, ordre, heurePassage? }`

### `transport.arrets.delete`
- **Type :** Mutation
- **Input :** `{ id: uuid }`

### `transport.affectations.list`
- **Type :** Query
- **Input :** `{ anneeScolaireId: uuid }`
- **Output :** `Affectation[] with elevePrenom, eleveNom, eleveMatricule, itineraireNom, arretNom`

### `transport.affectations.create`
- **Type :** Mutation
- **Input :** `{ eleveId: uuid, itineraireId: uuid, arretId: uuid, anneeScolaireId: uuid }`

### `transport.affectations.delete`
- **Type :** Mutation
- **Input :** `{ id: uuid }`

---

## Module Tableau de bord (`dashboard`)

### `dashboard.stats`
- **Type :** Query
- **Input :** `{ anneeScolaireId: uuid }`
- **Output :** `{ totalEleves, totalClasses, totalPaiements, totalDepenses, totalEmployes, masseSalariale, totalImpayes }` (`totalImpayes` = `finance.impayes.list.totalReste`)

### `dashboard.studentsByNiveau`
- **Type :** Query
- **Input :** `{ anneeScolaireId: uuid }`
- **Output :** `{ niveauNom: string, count: number }[]`

### `dashboard.recentPayments`
- **Type :** Query
- **Input :** `{ anneeScolaireId: uuid }`
- **Output :** 10 derniers paiements avec `elevePrenom, eleveNom, typeFraisNom`

### `dashboard.monthlyRevenue`
- **Type :** Query
- **Input :** `{ anneeScolaireId: uuid }`
- **Output :** `{ mois: number, total: number }[]`

---

## Module Paramètres (`settings`)

### `settings.get`
- **Type :** Query (protégée)
- **Output :** ligne `parametres_ecole` sans `id` ni `updated_at`. Retombe sur les valeurs par défaut CEMAS si la table ou la ligne manque.

### `settings.public`
- **Type :** Query (publique — utilisée par la page de connexion)
- **Output :** `{ nom: string, sigle: string }`

### `settings.update`
- **Type :** Mutation (protégée)
- **Input :** `updateParametresSchema` — `nom` (2–150), `sigle` (1–30) obligatoires ; `adresse`, `telephone1`, `telephone2`, `email` (format email), `contactsEntete` optionnels (vide → `null`) ; `prefixeMatricule`, `prefixeRecu`, `prefixeEmploye` : `^[A-Z0-9]{2,10}$`
- **Output :** ligne mise à jour
- **Erreurs :** `BAD_REQUEST` avec `data.zodError.fieldErrors` par champ

### Génération des identifiants
`students.create`, `finance.paiements.create` et `payroll.employes.create` calculent la séquence suivante sur les seuls identifiants qui commencent par le préfixe configuré (et l'année pour matricules et reçus), par comparaison numérique (`nextSequence` dans `src/shared/lib/sequence.ts`).

---

> Ce fichier est la source de vérité pour la spécification API du projet CEMAS.
