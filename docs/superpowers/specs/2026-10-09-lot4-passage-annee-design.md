# Lot 4 — Passage à l'année suivante (design)

Date : 2026-10-09 · Statut : design validé en conversation, en attente de relecture de la spec
Source : `docs/17_prompt_ameliorations_web.md` § 4

## 1. Objectif

En fin d'année (juillet), faire passer toute l'école à l'année suivante en une opération sûre : nouvelle année, classes et grille recopiées, élèves répartis (passent, redoublent, quittent), ancienne année archivée.

### Critères de réussite
- Le directeur configure une fois la classe suivante de chaque classe (ou « fin de cycle »).
- Un assistant en 4 étapes permet de décider élève par élève, avec une prévisualisation chiffrée avant validation.
- L'exécution est atomique : tout ou rien.
- Après exécution : la nouvelle année est active, l'ancienne archivée ; chaque élève qui reste est dans la bonne classe de la nouvelle année avec une inscription ; les sortants et départs sont inactifs ; les données de l'ancienne année (paiements, inscriptions, classes) sont intactes.

### Hors périmètre
- Affectations de transport (à refaire chaque année), bulletins de paie, dépenses/recettes.
- Annulation d'un passage (restauration depuis la sauvegarde — lot 5).
- Passage partiel (une seule classe).

## 2. Modèle actuel (constats)

- `classes` appartiennent à une année (`annee_scolaire_id`).
- `eleves.classe_id` et `eleves.annee_scolaire_id` désignent la classe/année courantes ; ils sont utilisés par la liste des élèves, le tableau de bord, le suivi et les impayés.
- `inscriptions` : une ligne par (élève, année), unique ; la création d'élève met `statut = 'confirmee'`.
- `grille_frais` : par (classe, frais, année).
- `annees_scolaires.active` (une seule) et `archived` ; procédures `setActive` et `archive` existantes (une année active ne peut pas être archivée).

## 3. Données — migration 0007

| Table | Colonne | Type | Contrainte |
|---|---|---|---|
| `classes` | `classe_suivante_id` | uuid | nullable, FK → `classes.id` ON DELETE SET NULL |
| `classes` | `fin_de_cycle` | boolean | NOT NULL, default false |

Règle : une classe est **configurée** si `fin_de_cycle = true` ou `classe_suivante_id` non nul (classe de la même année, différente d'elle-même — vérifié côté serveur). Les deux ne peuvent pas être vrais ensemble (fin de cycle ⇒ classe suivante ignorée et mise à null).

## 4. Règles du passage

Entrées : année source `S` (l'année active), année cible `C` (libellé, dates), décisions par élève.

1. **Année cible** : si une année non archivée de même libellé existe, elle est réutilisée (dates mises à jour) ; sinon créée. `C ≠ S` obligatoire.
2. **Classes** : chaque classe de `S` est recopiée dans `C` (nom, niveau, capacité, `fin_de_cycle`). Si une classe de même nom existe déjà dans `C`, elle est réutilisée (pas de doublon). `classe_suivante_id` des copies est remappé vers la copie de la classe suivante.
3. **Grille** : chaque ligne de `grille_frais` de `S` est recopiée sur la copie de sa classe (upsert : une valeur déjà saisie dans `C` est conservée).
4. **Élèves concernés** : statut `actif` et classe appartenant à `S`.
5. **Décision par élève** (défaut `passe`) :
   - `passe` : classe de destination = copie de la classe suivante ; si la classe est `fin_de_cycle` → **sortant** ;
   - `redouble` : copie de la même classe ;
   - `quitte` : départ.
6. **Élève qui reste** (passe non sortant, redouble) : `eleves.classe_id` ← classe de destination, `eleves.annee_scolaire_id` ← `C` ; insertion `inscriptions` (élève, classe, `C`, `statut = 'confirmee'`, `montant_inscription = 0`) — si une inscription existe déjà pour (élève, `C`), elle est mise à jour.
7. **Sortant / départ** : `eleves.statut` ← `inactif` ; classe et année inchangées (restent rattachés à `S`).
8. **Fin** : `C` devient l'année active ; `S` est archivée.
9. **Refus** (aucune écriture) : une classe de `S` non configurée ; une classe suivante qui n'appartient pas à `S` ; une décision pour un élève inconnu ou non concerné ; `S` n'est pas l'année active ; `C` est archivée.
10. Tout se fait dans **une seule transaction**.

## 5. Serveur

### Fonction pure `src/modules/academic/passage.ts`
```ts
type Decision = "passe" | "redouble" | "quitte";
planifierPassage(params: {
  classes: { id, nom, niveauId, capacite, classeSuivanteId: string | null, finDeCycle: boolean }[];
  eleves: { id, classeId }[];                       // élèves concernés
  decisions: Record<string, Decision>;              // eleveId → décision (absent = "passe")
}): {
  erreurs: string[];                                // classes non configurées, etc.
  mouvements: { eleveId, classeSourceId, resultat: "promu" | "redouble" | "sortant" | "depart", classeDestinationSourceId: string | null }[];
  parClasse: { classeId, nom, promus, redoublants, sortants, departs }[];
  effectifsPrevus: { classeSourceId, nom, effectif, capacite }[];   // par classe de destination (identifiée par la classe source copiée)
}
```
Testée par Vitest. `classeDestinationSourceId` désigne la classe de `S` dont la copie accueille l'élève.

### Procédures `academic.passage.*`
| Procédure | Entrée | Sortie |
|---|---|---|
| `passage.contexte` | — | année active, proposition d'année cible (libellé `AAAA+1-AAAA+2`, dates +1 an), classes de l'année active avec configuration, élèves concernés par classe |
| `passage.configurerClasses` | `{ classes: { id, classeSuivanteId: uuid \| null, finDeCycle: boolean }[] }` | `{ count }` |
| `passage.preview` | `{ decisions }` | résultat de `planifierPassage` (sans écriture) |
| `passage.executer` | `{ cible: { libelle, dateDebut, dateFin }, decisions }` | `{ anneeId, promus, redoublants, sortants, departs, classesCreees, grilleCopiee }` |

`academic.classes.update` accepte aussi `classeSuivanteId` et `finDeCycle` (même validation).

## 6. Interface

### Académique → Classes
- Colonne « Classe suivante » : nom de la classe suivante, « Fin de cycle », ou badge orange « À configurer ».
- Formulaire de modification : sélecteur « Classe suivante » (classes de la même année + « Fin de cycle »).

### Académique → Années → « Passer à l'année suivante » (sur l'année active)
Assistant en 4 étapes :
1. **Nouvelle année** : libellé, date de début, date de fin (préremplis).
2. **Classes** : tableau classe → sélecteur (classe suivante / Fin de cycle) ; bouton « Enregistrer et continuer » (désactivé tant qu'une classe n'est pas configurée).
3. **Élèves** : une section par classe, chaque élève avec un choix Passe / Redouble / Quitte (défaut Passe) ; raccourci « Tous passent » par classe.
4. **Prévisualisation** : tableau par classe (promus, redoublants, sortants, départs) ; effectifs prévus par nouvelle classe (alerte si capacité dépassée) ; texte d'avertissement (« opération définitive ; une sauvegarde récente est recommandée ») ; bouton « Lancer le passage » + confirmation.
Après succès : message récapitulatif et lien vers la liste des élèves.

## 7. Tests

- Vitest `passage.test.ts` : passe → classe suivante ; fin de cycle → sortant ; redouble → même classe ; quitte → départ ; classe non configurée → erreur ; décision par défaut ; comptes par classe ; effectifs prévus.
- e2e `13-passage` (base neuve, via API + UI) : créer une année de test active avec 2 classes (A → B, B fin de cycle) et 3 élèves ; configurer ; exécuter avec une décision « redouble » ; vérifier : nouvelle année active, ancienne archivée, élève promu en B (nouvelle année), redoublant en A, élève de B inactif, classes et grille recopiées, paiements de l'ancienne année intacts. Le passage archive l'année active de la base de test et ne peut pas être annulé : le test ne s'exécute que si `E2E_DESTRUCTIF=1` (défini en CI, base jetable) et le fichier passe en dernier (`13-`). En local il est ignoré sauf demande explicite.

## 8. Documentation
- `02_features.md` : classe suivante, assistant de passage.
- `03_data_model.md` : colonnes `classe_suivante_id`, `fin_de_cycle`.
- `04_api_spec.md` : `academic.passage.*`, `classes.update`.
- `16_decisions.md` : D-018 « passage atomique, décisions par élève, sortants inactifs rattachés à l'ancienne année ».

## 9. Exploitation
- À lancer en fin d'année, après une sauvegarde (lot 5).
- La production a aujourd'hui 14 classes et ~150 élèves : une transaction de quelques centaines d'écritures.
