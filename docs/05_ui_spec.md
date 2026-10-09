# 05 - Spécification UI

## Design System

### Couleurs (Tailwind CSS v4 `@theme`)

| Token | Valeur | Usage |
|-------|--------|-------|
| `--color-primary` | #665d9d | Sidebar, boutons principaux, accents |
| `--color-primary-hover` | #554d87 | Hover sur primary |
| `--color-primary-light` | #e8e6f0 | Backgrounds légers |
| `--color-secondary` | #fbc616 | Accents secondaires, badges année |
| `--color-secondary-hover` | #e0b114 | Hover sur secondary |
| `--color-secondary-light` | #fef3cd | Backgrounds secondaires |
| `--color-success` | #16a34a | Statuts positifs, paiements effectués |
| `--color-danger` | #dc2626 | Erreurs, suppressions, impayés |
| `--color-warning` | #fbc616 | Avertissements |
| `--color-muted` | #6b7280 | Texte secondaire |
| `--color-surface` | #ffffff | Fond des cartes |
| `--color-background` | #f8f9fa | Fond de page |

### Typographie

- Font : `system-ui, -apple-system, sans-serif`
- Pas de police personnalisée (performance)

### Composants UI partagés

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `Button` | `button.tsx` | Bouton avec variantes : default, ghost, danger. Props: variant, disabled, type |
| `StatCard` | `stat-card.tsx` | Carte KPI avec icône, titre, valeur, trend optionnel |
| `PageHeader` | `page-header.tsx` | En-tête de page avec titre, breadcrumbs, action optionnelle |
| `FormModal` | `form-modal.tsx` | Modal de formulaire (`role="dialog"`) avec titre, overlay, fermeture |
| `ConfirmDialog` | `confirm-dialog.tsx` | Dialog de confirmation (`role="alertdialog"`) : titre, message, loading, `confirmLabel` / `loadingLabel` / `confirmVariant` (défaut « Supprimer », danger) |
| `StatusBadge` | `status-badge.tsx` | Badge coloré pour les statuts |
| `EmptyState` | `empty-state.tsx` | État vide avec message |
| `MonthPicker` | `month-picker.tsx` | Sélecteur de mois/année |
| `PrintLayout` | `print-layout.tsx` | En-tête d'impression (identité de l'école depuis Paramètres) ; non utilisé à ce jour |
| `DataTable` | `data-table.tsx` | Tableau de données avec tri, recherche, pagination |

### DataTable

Interface `Column<T>` :
```typescript
type Column<T> = {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
};
```

Props : `columns`, `data`, `searchPlaceholder`, `pageSize`, `onRowClick`

---

## Layout

### Sidebar (260px, fixe)
- Fond : `bg-primary` (violet #665d9d)
- Logo : icône graduation cap sur fond `bg-secondary`, **sigle de l'école** (Paramètres) et « Gestion Ecole »
- Navigation : items avec icônes Lucide, sous-menus dépliables avec chevron
- Mobile : overlay avec bouton fermeture

### Structure des pages
```
┌──────────┬───────────────────────────┐
│          │  PageHeader               │
│          │  (titre + breadcrumbs)    │
│ Sidebar  ├───────────────────────────┤
│ (260px)  │                           │
│          │  Contenu de la page       │
│          │  (padding: px-6 py-6)     │
│          │                           │
│          │                           │
└──────────┴───────────────────────────┘
```

---

## Navigation

| Section | Sous-pages | Icônes |
|---------|-----------|--------|
| Tableau de bord | / | LayoutDashboard |
| Académique | /academique/annees (+ /annees/passage), /classes, /matieres | BookOpen, Calendar, BookOpenCheck, ClipboardList |
| Élèves | /eleves, /eleves/nouveau, /eleves/[id] | Users |
| Finances | /finances/paiements, /suivi, /impayes, /grille, /depenses, /recettes, /bilan | Banknote, CreditCard, TrendingUp, TriangleAlert, Table, Receipt, DollarSign, FileText |
| Transport | /transport/vehicules, /itineraires, /affectations, /suivi | Bus, Truck, MapPin, UserCheck, TrendingUp |
| Paie | /payroll/employes, /bulletins, /historique | Briefcase, UserPlus, FileText, History |
| Paramètres | /parametres | Settings |

---

## Pages (24 au total)

### Connexion (`/login`)
- Titre « Gestion Ecole », nom de l'établissement dessous (`settings.public`)

### Tableau de bord (`/`)
- 7 StatCards : élèves, classes, paiements encaissés, dépenses, **impayés** (lien vers `/finances/impayes`), employés actifs, masse salariale
- BarChart Recharts : paiements mensuels par mois
- PieChart Recharts : répartition élèves par niveau
- Tableau : 10 derniers paiements

### Élèves (`/eleves`)
- Filtres : année scolaire (auto-détectée), classe, niveau, recherche
- DataTable avec colonnes : matricule, nom, classe, niveau, statut
- Clic sur ligne → navigation vers `/eleves/[id]`

### Inscription (`/eleves/nouveau`)
- 3 étapes : élève ; contact principal + « Ajouter un 2e contact » (facultatif, retirable) ; classe + récapitulatif
- Classes proposées avec leur remplissage « CP (11/30) » ; classe pleine → avertissement orange et confirmation « Inscrire quand même ? »
- Soumission → fiche de l'élève

### Fiche élève (`/eleves/[id]`)
- Carte info : matricule, nom complet, date/lieu naissance, sexe, classe, niveau, statut
- « Parents / Contacts » : badge « Principal » sur le premier contact ; bouton « Ajouter un 2e contact » (modale) tant qu'il n'y en a qu'un

### Finances - Paiements (`/finances/paiements`)
- Sélection mois + année scolaire
- DataTable des paiements du mois ; téléchargement du reçu PDF (A5, en-tête de l'école)
- Bouton nouveau paiement → FormModal

### Finances - Impayés (`/finances/impayes`)
- Filtres niveau / classe ; bandeau si des classes utilisent le montant par défaut
- Tableau : case à cocher, matricule, élève, classe, dû, payé, reste, mois impayés, téléphone du contact principal, bouton « Lettre » ; pied avec totaux
- Bouton « Lettres de relance (N) » : un PDF A4, une page par élève sélectionné

### Finances - Grille tarifaire (`/finances/grille`)
- Tableau classes × frais obligatoires, cellules numériques (placeholder = montant par défaut, badge « à renseigner »)
- « Appliquer au niveau » par ligne ; « Enregistrer » (seules les cases modifiées)

### Finances - Suivi (`/finances/suivi`)
- Sélecteur de classe
- Grille par type de frais : élèves en lignes, mois (Oct-Jul) en colonnes
- Pastilles rondes colorées : vert (payé), rouge (non payé)

### Finances - Dépenses (`/finances/depenses`)
- StatCard total des dépenses
- DataTable avec colonnes : date, catégorie, libellé, montant, note
- Bouton supprimer par ligne
- FormModal avec sélecteur catégorie

### Finances - Recettes (`/finances/recettes`)
- Même pattern que dépenses

### Finances - Bilan (`/finances/bilan`)
- Badge année scolaire active
- 5 StatCards : paiements, recettes, dépenses, salaires payés, solde
- Détail : paiements (+), recettes (+), dépenses (−), salaires (−), solde net
- « Détail par mois » (trésorerie) : solde du mois, solde cumulé, ligne de total

### Paie - Employés (`/payroll/employes`)
- DataTable : matricule, nom, poste, type, salaire, statut
- FormModal création employé

### Paie - Bulletins (`/payroll/bulletins`)
- Sélecteur mois/année + bouton génération
- 4 StatCards : total net, primes, retenues, effectif
- DataTable avec édition inline des primes/retenues
- Bouton "Marquer payé" ; bouton « Fiche » (PDF A5) par ligne ; « Imprimer les fiches du mois (N) »

### Paie - Historique (`/payroll/historique`)
- Sélecteur année
- Tableau 12 mois avec totaux : base, primes, retenues, net, payés

### Transport (4 pages)
- Véhicules, Itinéraires, Affectations, Suivi

### Académique - Classes (`/academique/classes`)
- Colonnes : nom, niveau, effectif (`n / capacité`), places restantes (badge vert/orange/rouge), classe suivante (nom, « Fin de cycle » ou « À configurer »)
- Modale de modification : sélecteur « Classe suivante »

### Académique - Passage à l'année suivante (`/academique/annees/passage`)
- Lien sur l'année active (page Années scolaires)
- Assistant : 1. nouvelle année ; 2. classe suivante de chaque classe ; 3. décision par élève (Passe / Redouble / Quitte) ; 4. vérification et confirmation

### Paramètres (`/parametres`)
- Formulaire « Établissement » : nom, sigle, adresse, téléphones, email, ligne de contacts, préfixes d'identifiants
- Compte utilisateur, niveaux, « À propos » (Gestion Ecole)

---

## Formatage

| Fonction | Usage | Exemple |
|----------|-------|---------|
| `formatCFA(amount)` | Montants FCFA | `150 000 FCFA` |
| `formatDate(date)` | Dates FR | `30/09/2026` |
| `MOIS_LABELS[mois]` | Noms des mois | `Octobre` |

---

> Ce fichier est la source de vérité pour la spécification UI du projet CEMAS.
