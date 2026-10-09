# Gestion Ecole (Excel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produire `excel/dist/Gestion Ecole.xlsm`, un classeur Excel autonome (Windows) qui remplace l'application web CEMAS : scolarité, finances, impayés/relances, paie, transport, bilan, tableau de bord, nouvelle année, sauvegarde.

**Architecture:** Un générateur Python (XlsxWriter) écrit toute la structure du classeur (feuilles, tableaux structurés, formules, listes, mises en forme, graphiques, gabarits d'impression) dans un `.xlsx`. Un classeur outil `Builder.xlsm`, piloté depuis Python par xlwings sur Excel Mac, injecte les modules VBA (`excel/vba/*.bas`, convertis en ASCII), crée les boutons et enregistre le `.xlsm` final. Les tests pytest pilotent le classeur livré via xlwings (mode test : les messages sont écrits dans une cellule au lieu d'une MsgBox).

**Tech Stack:** Python 3.12 (venv `excel/.venv`), XlsxWriter 3.1.9, xlwings 0.32.1, openpyxl 3.1.2, pytest 8.3.3, Excel Mac 16.113 (construction/tests), Excel Windows Microsoft 365/2019+ (cible), VBA.

**Spec:** `docs/superpowers/specs/2026-10-08-gestion-ecole-excel-design.md`

### Écarts assumés par rapport à la spec (à signaler en revue)
- Les journaux (Paiements, Dépenses, Recettes, Bulletins, Affectations) n'ont **pas** de colonne Année : ils ne contiennent que l'année active et sont archivés puis vidés par « Nouvelle année ». Seuls Élèves (colonne Année) et l'Année active portent l'année. La grille tarifaire est conservée telle quelle d'une année à l'autre (= « recopiée »).
- Le menu de l'Accueil est fait de liens hypertexte stylés en boutons (fonctionnent même macros désactivées) ; les boutons de formulaire servent aux actions.
- Les frais ont une **Périodicité** (Mensuel / Unique), reprise de la colonne `mensuel` du seed de l'app. Paiement d'un frais unique : Mois = « Unique ».

## Global Constraints

- Cible : Excel Windows Microsoft 365 / 2019+. Construction et tests : Excel Mac 16.113 sur ce poste.
- Formules : uniquement fonctions compatibles 2019 sans tableau dynamique — **interdits** : FILTER, XLOOKUP, LET, UNIQUE, SORT, SEQUENCE, TEXTJOIN, LAMBDA. Utiliser SUMIFS, COUNTIFS, INDEX, MATCH, IFERROR, SUM, MAX, MIN, MOD.
- Formules de colonnes calculées XlsxWriter : toujours la forme qualifiée et entre crochets `tblX[@[Colonne]]` (jamais `[@Colonne]`), car XlsxWriter remplace `@` par `[#This Row],`.
- En-têtes de tableaux : sans apostrophe, crochet ni `#`.
- VBA : `Option Explicit` dans chaque module ; pas de `Declare`, pas de `Scripting.FileSystemObject`, pas de `Scripting.Dictionary`, pas d'UserForm, pas d'ActiveX ; chemins via `Application.PathSeparator` ; fichiers produits sous `Dossier(...)`.
- VBA : accents autorisés **uniquement** dans les chaînes et commentaires (le préprocesseur les convertit en `ChrW`) ; identifiants ASCII ; **aucune** `Const` contenant des accents.
- VBA : jamais de `MsgBox` direct — toujours `Notifier` / `Confirmer` (modUtil), sinon les tests bloquent.
- Chaque tableau garde au moins une ligne de données (ligne vide « réservée ») ; insertion uniquement via `NouvelleLigne`.
- Textes visibles en français. Montants entiers en FCFA, format `#,##0 "FCFA"`.
- Mois scolaires : Octobre → Juillet (10). Mois de paie et de bilan : Octobre → Septembre (12).
- Préfixes par défaut : `ELV`, `REC`, `EMP`. Matricule `{Prefixe_Matricule}-{AnneeDebut}-0001`, reçu `{Prefixe_Recu}-{AnneeDebut}-0001`, employé `{Prefixe_Employe}-001`.
- Aucune protection de feuille ni mot de passe.
- Toutes les commandes se lancent depuis `excel/` avec `.venv/bin/python`. Dossier de travail Excel (sandbox Office) : `~/Library/Group Containers/UBF8T346G9.Office/GestionEcole/`.

## Review Focus

- Noms avec accents et apostrophes (« Ndèye N'Diaye ») : stockés et affichés à l'identique — test Task 3.
- Montant saisi comme texte avec espaces (« 25 000 ») : compris comme 25000 ; texte non numérique refusé — test Task 4.
- Première saisie après que « Nouvelle année » a vidé les journaux : la ligne réservée est réutilisée, numérotation repart à `REC-2027-0001` — test Task 12.
- Élèves inactifs/transférés : exclus des effectifs, du suivi et des impayés — tests Task 3 et Task 5.
- Date hors année scolaire (septembre avant la rentrée, août après) : mois écoulés bornés 0…10, dû = 0 avant la rentrée — tests Task 2 et Task 5.

## Structure des fichiers

```
excel/
  README.md                 # build & tests (développeur)
  requirements.txt
  pytest.ini
  .gitignore
  gen/                      # générateur Python
    __init__.py
    paths.py                # chemins (repo, dist, dossier sandbox Office)
    book.py                 # Book : formats, tableaux, noms, boutons
    vba_ascii.py            # préprocesseur VBA UTF-8 -> ASCII (ChrW)
    excel_driver.py         # pilotage d'Excel (xlwings) : lance Builder
    build.py                # point d'entrée : python -m gen.build
    sheets/
      __init__.py
      config.py             # feuille masquée _Config (listes, CFG_*, tblModules, tblBoutons, tblTables)
      accueil.py            # Accueil (menu)
      dashboard.py          # Tableau de bord
      parametres.py         # Paramètres + référentiels
      scolarite.py          # Inscription, Élèves, Classes
      finances.py           # Saisie paiement, Paiements, Grille tarifaire
      suivi.py              # Suivi, Impayés
      compta.py             # Dépenses, Recettes, Bilan
      paie.py               # Employés, Bulletins, Historique paie
      transport.py          # Véhicules, Itinéraires, Affectations
      modeles.py            # Modèle Reçu / Relance / Fiche de paie
      aide.py               # Aide (exportée en Guide d'utilisation.pdf)
  vba/
    modUtil.bas  modIds.bas  modEleves.bas  modFinances.bas  modPaie.bas
    modTransport.bas  modImpression.bas  modSauvegarde.bas  modAnnee.bas
    modParams.bas  ThisWorkbook.bas
  tools/
    Builder.bas             # source du Builder (collé une fois à la main)
    Builder.xlsm            # classeur outil (créé une fois à la main, versionné)
  tests/
    conftest.py  helpers.py
    test_vba_ascii.py  test_pipeline.py  test_parametres.py  test_inscription.py
    test_paiements.py  test_suivi_impayes.py  test_paie.py  test_bilan.py
    test_transport.py  test_impression.py  test_dashboard.py  test_sauvegarde.py
    test_nouvelle_annee.py  test_logo.py
  dist/
    Gestion Ecole.xlsm  Guide d'utilisation.pdf  Checklist Windows.md
```

---

### Task 1: Chaîne de construction et de test

**Files:**
- Create: `excel/requirements.txt`, `excel/pytest.ini`, `excel/.gitignore`, `excel/README.md`
- Create: `excel/gen/__init__.py`, `excel/gen/paths.py`, `excel/gen/book.py`, `excel/gen/vba_ascii.py`, `excel/gen/excel_driver.py`, `excel/gen/build.py`
- Create: `excel/gen/sheets/__init__.py`, `excel/gen/sheets/config.py`, `excel/gen/sheets/accueil.py`
- Create: `excel/vba/modUtil.bas`, `excel/tools/Builder.bas`, `excel/tools/Builder.xlsm` (manuel)
- Test: `excel/tests/conftest.py`, `excel/tests/helpers.py`, `excel/tests/test_vba_ascii.py`, `excel/tests/test_pipeline.py`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `gen.book.Book(path)` avec `.f[nom_format]`, `.sheet(name, title=None, back_link=True) -> Worksheet`, `.name(name, ref)`, `.cell_name(name, sheet, "B3")`, `.table(sheet, name, top, left, columns, rows=None)` (colonnes : dicts `h`, `f`, `fmt`, `w`, `list`), `.button(sheet, cell, text, macro, width=150)`, `.module(filename)`, `.close()` ; attributs `.ws`, `.tables`, `.buttons`, `.modules`.
  - `gen.build.SHEET_BUILDERS` (liste ordonnée de fonctions `f(book)`) et `gen.build.MODULES` (liste ordonnée de fichiers `.bas`).
  - VBA `modUtil` : `Tbl(nom) As ListObject`, `Col(lo, entete) As Long`, `NombreLignes(lo) As Long`, `NouvelleLigne(lo) As Long`, `Valeur(lo, i, entete)`, `Ecrire lo, i, entete, v`, `Colonne(lo, entete)` (tableau 2D), `TrouverLigne(lo, entete, v) As Long`, `ValeurDans(lo, enteteCle, cle, enteteVal)` (Empty si absent), `ViderTable lo`, `Nom(n)` (évalue un nom), `Champ(n)` / `DefinirChamp n, v` (cellule nommée), `EffacerFormulaire prefixe`, `FeuilleDe(n) As Worksheet`, `ModeTest() As Boolean`, `Notifier msg`, `Confirmer(msg) As Boolean`, `Debut`, `Fin`, `Dossier(sous) As String` (finit par le séparateur), `NomFichier(s)`, `LireMontant(v) As Double` (-1 si invalide), `MatriculeDe(libelle)`, `IndexMois(m)`, `IndexMois12(m)`, `MoisNom(i)`, `MoisNom12(i)` ; hooks de test `Ping`, `TestAccents`, `TestInfoBouton`, `TestClicBouton`, `TestNouvelleLigne`, `TestExisteForme`.
  - Noms Excel : `CFG_ModeTest`, `CFG_ReponseTest`, `CFG_DernierMessage`, `CFG_Journal`, `CFG_DossierSortie`, listes `L_Mois`, `L_Mois12`, `L_MoisPaiement`, `L_Sexe`, `L_Relation`, `L_Statut`, `L_StatutEmp`, `L_OuiNon`, `L_TypeEmp`, `L_Periodicite`.
  - Tests : fixture `g` (objet `helpers.Gestion`) avec `.run(macro, *args)`, `.get(name)`, `.set(name, v)`, `.fill(dict)`, `.message()`, `.eval(expr)`, `.rows(table) -> list[dict]`, `.find(table, header, value) -> int`, `.cell(table, idx, header)` (Range xlwings), `.set_row(table, idx, dict)`, `.add_row(table, dict) -> int`, `.dir` (Path du dossier du classeur testé).

- [ ] **Step 0 (manuel, une seule fois) : préparer Excel Mac**

Demander à l'utilisateur (humain) de faire dans Excel Mac :
1. Excel → Réglages… → Sécurité : cocher **« Faire confiance à l'accès au modèle d'objet du projet VBA »** et choisir **« Activer toutes les macros »** (poste de développement uniquement).
2. Créer le classeur outil : Fichier → Nouveau classeur ; Outils → Macro → Éditeur Visual Basic ; Insertion → Module ; coller le contenu de `excel/tools/Builder.bas` (Step 9) ; Fichier → Enregistrer sous… format **« Classeur Excel prenant en charge les macros (.xlsm) »** dans `excel/tools/Builder.xlsm`. Fermer.

Ne pas continuer après le Step 9 tant que `excel/tools/Builder.xlsm` n'existe pas.

- [ ] **Step 1 : environnement Python**

`excel/requirements.txt` :
```
XlsxWriter==3.1.9
xlwings==0.32.1
openpyxl==3.1.2
pytest==8.3.3
```
`excel/pytest.ini` :
```ini
[pytest]
testpaths = tests
pythonpath = . tests
addopts = -q
```
`excel/.gitignore` :
```
.venv/
__pycache__/
.pytest_cache/
```
Run: `cd excel && /opt/anaconda3/bin/python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
Expected: installation OK (xlwings tire `appscript` et `psutil`).

- [ ] **Step 2 : test du préprocesseur (doit échouer)**

`excel/tests/test_vba_ascii.py` :
```python
import pytest
from gen.vba_ascii import convert_line, convert_text, VbaAsciiError


def test_accent_dans_chaine():
    assert convert_line('MsgBox "Élève"') == 'MsgBox "" & ChrW(201) & "lève"'


def test_guillemets_doubles_conserves():
    assert convert_line('x = "a""é"') == 'x = "a""" & ChrW(233) & ""'


def test_commentaire_translittere():
    assert convert_line("y = 1 ' Élève à jour") == "y = 1 ' Eleve a jour"


def test_identifiant_non_ascii_refuse():
    with pytest.raises(VbaAsciiError):
        convert_line("Dim élève As String")


def test_const_avec_accent_refuse():
    with pytest.raises(VbaAsciiError):
        convert_line('Private Const T As String = "Été"')


def test_fins_de_ligne_crlf():
    assert convert_text("a\nb\n") == "a\r\nb\r\n"
```
Run: `cd excel && .venv/bin/python -m pytest tests/test_vba_ascii.py`
Expected: FAIL (`ModuleNotFoundError: gen`).

- [ ] **Step 3 : préprocesseur**

`excel/gen/__init__.py` et `excel/gen/sheets/__init__.py` : fichiers vides.

`excel/gen/vba_ascii.py` :
```python
"""Convertit un module VBA UTF-8 en ASCII pur : accents des chaînes -> ChrW(n)."""
import unicodedata
from pathlib import Path

CONST_PREFIXES = ("const ", "public const ", "private const ")


class VbaAsciiError(ValueError):
    pass


def _strip_accents(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")


def convert_line(line: str, lineno: int = 0) -> str:
    out, i, in_str = [], 0, False
    if line.lstrip().lower().startswith(CONST_PREFIXES):
        code = line.split("'", 1)[0] if '"' not in line else line
        if any(ord(c) > 127 for c in code):
            raise VbaAsciiError(f"ligne {lineno}: Const avec accents interdit")
    while i < len(line):
        ch = line[i]
        if in_str:
            if ch == '"':
                if i + 1 < len(line) and line[i + 1] == '"':
                    out.append('""')
                    i += 2
                    continue
                in_str = False
                out.append('"')
            elif ord(ch) > 127:
                if ord(ch) > 0xFFFF:
                    raise VbaAsciiError(f"ligne {lineno}: caractère hors BMP {ch!r}")
                out.append(f'" & ChrW({ord(ch)}) & "')
            else:
                out.append(ch)
        else:
            if ch == '"':
                in_str = True
                out.append('"')
            elif ch == "'":
                out.append(_strip_accents(line[i:]))
                break
            elif ord(ch) > 127:
                raise VbaAsciiError(f"ligne {lineno}: caractère non ASCII hors chaîne {ch!r}")
            else:
                out.append(ch)
        i += 1
    return "".join(out)


def convert_text(text: str) -> str:
    lines = text.splitlines()
    return "".join(convert_line(l, n) + "\r\n" for n, l in enumerate(lines, 1))


def convert_file(src: Path, dst: Path) -> None:
    dst.write_text(convert_text(src.read_text(encoding="utf-8")), encoding="ascii", newline="")
```
Run: `cd excel && .venv/bin/python -m pytest tests/test_vba_ascii.py`
Expected: 6 passed.

- [ ] **Step 4 : chemins et Book**

`excel/gen/paths.py` :
```python
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # excel/
VBA_SRC = ROOT / "vba"
DIST = ROOT / "dist"
DIST_XLSM = DIST / "Gestion Ecole.xlsm"
DIST_GUIDE = DIST / "Guide d'utilisation.pdf"
BUILDER_SRC = ROOT / "tools" / "Builder.xlsm"
# Dossier toujours accessible à Excel Mac (sandbox Office)
WORK = Path.home() / "Library" / "Group Containers" / "UBF8T346G9.Office" / "GestionEcole"
STAGE = WORK / "stage"
RUNS = WORK / "run"
```

`excel/gen/book.py` :
```python
"""Aide à l'écriture du classeur avec XlsxWriter : formats, tableaux, noms, boutons."""
import xlsxwriter

PRIMARY = "#1F4E79"
INPUT_FILL = "#FFF2CC"
MONEY = '#,##0 "FCFA"'


class Book:
    def __init__(self, path):
        self.wb = xlsxwriter.Workbook(str(path))
        self.ws = {}
        self.tables = {}   # nom du tableau -> nom de la feuille
        self.buttons = []  # (feuille, cellule, largeur, texte, macro)
        self.modules = []  # fichiers .bas, dans l'ordre d'import
        w = self.wb
        self.f = {
            "title": w.add_format({"bold": True, "font_size": 18, "font_color": PRIMARY}),
            "subtitle": w.add_format({"italic": True, "font_size": 12, "font_color": "#595959"}),
            "h2": w.add_format({"bold": True, "font_size": 12, "font_color": PRIMARY, "bottom": 1}),
            "label": w.add_format({"bold": True}),
            "info": w.add_format({"italic": True, "font_color": "#595959"}),
            "input": w.add_format({"bg_color": INPUT_FILL, "border": 1}),
            "input_text": w.add_format({"bg_color": INPUT_FILL, "border": 1, "num_format": "@"}),
            "input_date": w.add_format({"bg_color": INPUT_FILL, "border": 1, "num_format": "dd/mm/yyyy"}),
            "input_money": w.add_format({"bg_color": INPUT_FILL, "border": 1, "num_format": "#,##0"}),
            "money": w.add_format({"num_format": MONEY}),
            "money_b": w.add_format({"num_format": MONEY, "bold": True, "font_size": 13}),
            "int": w.add_format({"num_format": "0"}),
            "date": w.add_format({"num_format": "dd/mm/yyyy"}),
            "time": w.add_format({"num_format": "hh:mm"}),
            "text": w.add_format({"num_format": "@"}),
            "wrap": w.add_format({"text_wrap": True, "valign": "top"}),
            "link": w.add_format({"font_color": "#0563C1", "underline": 1}),
            "menu": w.add_format({"bold": True, "font_size": 12, "font_color": "#FFFFFF",
                                  "bg_color": PRIMARY, "align": "center", "valign": "vcenter",
                                  "border": 2, "border_color": "#FFFFFF"}),
            "hdr": w.add_format({"bold": True, "font_color": "#FFFFFF", "bg_color": PRIMARY,
                                 "border": 1, "align": "center", "text_wrap": True}),
            "cell": w.add_format({"border": 1}),
            "cell_money": w.add_format({"border": 1, "num_format": MONEY}),
            "cell_money_b": w.add_format({"border": 1, "num_format": MONEY, "bold": True}),
            "kpi_label": w.add_format({"font_color": "#595959", "bg_color": "#F2F2F2",
                                       "align": "center", "text_wrap": True}),
            "kpi_value": w.add_format({"bold": True, "font_size": 16, "bg_color": "#F2F2F2",
                                       "align": "center", "num_format": "#,##0"}),
            "green": w.add_format({"bg_color": "#C6EFCE", "font_color": "#006100"}),
            "red": w.add_format({"bg_color": "#FFC7CE", "font_color": "#9C0006"}),
            "grey": w.add_format({"font_color": "#A6A6A6"}),
        }

    def sheet(self, name, title=None, back_link=True):
        ws = self.wb.add_worksheet(name)
        self.ws[name] = ws
        if title:
            ws.write(0, 0, title, self.f["title"])
        if back_link:
            ws.write_url(1, 0, "internal:'Accueil'!A1", self.f["link"], string="← Accueil")
        return ws

    def name(self, name, ref):
        self.wb.define_name(name, ref if ref.startswith("=") else "=" + ref)

    def cell_name(self, name, sheet, cell):
        col = "".join(c for c in cell if c.isalpha())
        row = cell[len(col):]
        self.name(name, f"'{sheet}'!${col}${row}")

    def table(self, sheet, name, top, left, columns, rows=None, style="Table Style Medium 2"):
        """columns : dicts {h: en-tête, f: formule (tblX[@[Col]]), fmt, w: largeur, list: nom de liste}."""
        ws = self.ws[sheet]
        rows = rows or []
        n = max(len(rows), 1)
        cols = []
        for i, c in enumerate(columns):
            d = {"header": c["h"]}
            if "f" in c:
                d["formula"] = c["f"]
            if "fmt" in c:
                d["format"] = self.f[c["fmt"]]
            cols.append(d)
            ws.set_column(left + i, left + i, c.get("w", 14), self.f[c["fmt"]] if "fmt" in c else None)
            if "list" in c:
                ws.data_validation(top + 1, left + i, top + 2000, left + i,
                                   {"validate": "list", "source": "=" + c["list"]})
        opts = {"name": name, "columns": cols, "style": style}
        if rows:
            opts["data"] = [[r.get(c["h"]) for c in columns] for r in rows]
        ws.add_table(top, left, top + n, left + len(columns) - 1, opts)
        self.tables[name] = sheet

    def button(self, sheet, cell, text, macro, width=150):
        """Bouton créé par le Builder (hauteur 26 pt) ; la ligne est agrandie pour ne pas déborder."""
        self.buttons.append((sheet, cell, width, text, macro))
        row = int("".join(c for c in cell if c.isdigit())) - 1
        self.ws[sheet].set_row(row, 30)

    def module(self, filename):
        if filename not in self.modules:
            self.modules.append(filename)

    def close(self):
        self.wb.close()
```

- [ ] **Step 5 : feuilles _Config et Accueil (provisoire)**

`excel/gen/sheets/config.py` :
```python
"""Feuille masquée _Config : listes, réglages CFG_*, tables lues par le Builder et les tests."""
from xlsxwriter.utility import xl_col_to_name

MOIS10 = ["Octobre", "Novembre", "Décembre", "Janvier", "Février", "Mars",
          "Avril", "Mai", "Juin", "Juillet"]
MOIS12 = MOIS10 + ["Août", "Septembre"]

LISTES = {
    "L_Mois": MOIS10,
    "L_Mois12": MOIS12,
    "L_MoisPaiement": MOIS10 + ["Unique"],
    "L_Sexe": ["M", "F"],
    "L_Relation": ["Père", "Mère", "Tuteur"],
    "L_Statut": ["Actif", "Inactif", "Transféré"],
    "L_StatutEmp": ["Actif", "Inactif"],
    "L_OuiNon": ["Oui", "Non"],
    "L_TypeEmp": ["Enseignant", "Administratif", "Entretien"],
    "L_Periodicite": ["Mensuel", "Unique"],
}

CFG = [("CFG_ModeTest", False), ("CFG_ReponseTest", "Oui"), ("CFG_DernierMessage", ""),
       ("CFG_Journal", ""), ("CFG_DossierSortie", "")]


def build(book):
    """À appeler en dernier : la feuille se place après toutes les autres."""
    ws = book.sheet("_Config", back_link=False)
    for j, (name, values) in enumerate(LISTES.items()):
        ws.write(0, j, name, book.f["label"])
        for i, v in enumerate(values):
            ws.write(1 + i, j, v)
        col = xl_col_to_name(j)
        book.name(name, f"'_Config'!${col}$2:${col}${1 + len(values)}")
    base = len(LISTES) + 1
    for i, (name, val) in enumerate(CFG):
        ws.write(i, base, name, book.f["label"])
        ws.write(i, base + 1, val)
        book.cell_name(name, "_Config", f"{xl_col_to_name(base + 1)}{i + 1}")
    book.button("_Config", "A40", "Ping", "modUtil.Ping", 60)
    top = 20
    book.table("_Config", "tblModules", top, 0, [{"h": "Fichier", "w": 22}],
               [{"Fichier": m} for m in book.modules])
    book.table("_Config", "tblBoutons", top, 2,
               [{"h": "Feuille"}, {"h": "Cellule"}, {"h": "Largeur"}, {"h": "Texte", "w": 34},
                {"h": "Macro", "w": 34}],
               [{"Feuille": s, "Cellule": c, "Largeur": w, "Texte": t, "Macro": m}
                for (s, c, w, t, m) in book.buttons])
    tables = [{"Table": t, "Feuille": s} for t, s in book.tables.items()]
    tables.append({"Table": "tblTables", "Feuille": "_Config"})
    book.table("_Config", "tblTables", top, 8, [{"h": "Table", "w": 20}, {"h": "Feuille", "w": 22}],
               tables)
    ws.hide()
```

`excel/gen/sheets/accueil.py` (version provisoire, remplacée en Task 10) :
```python
def build(book):
    ws = book.sheet("Accueil", "Gestion Ecole", back_link=False)
    ws.set_column(0, 0, 30)
    ws.activate()
```

- [ ] **Step 6 : modUtil.bas**

`excel/vba/modUtil.bas` :
```vba
Option Explicit
' Outils communs : tableaux, noms, messages, dossiers, mois.

' ---------- Tableaux ----------
Public Function Tbl(ByVal nom As String) As ListObject
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        On Error Resume Next
        Set Tbl = ws.ListObjects(nom)
        On Error GoTo 0
        If Not Tbl Is Nothing Then Exit Function
    Next ws
    Err.Raise vbObjectError + 1, , "Tableau introuvable : " & nom
End Function

Public Function Col(ByVal lo As ListObject, ByVal entete As String) As Long
    Col = lo.ListColumns(entete).Index
End Function

Private Function EstVide(ByVal lo As ListObject) As Boolean
    EstVide = (lo.ListRows.Count = 1 And Trim$(CStr(lo.DataBodyRange.Cells(1, 1).Value)) = "")
End Function

Public Function NombreLignes(ByVal lo As ListObject) As Long
    If lo.ListRows.Count = 0 Then
        NombreLignes = 0
    ElseIf EstVide(lo) Then
        NombreLignes = 0
    Else
        NombreLignes = lo.ListRows.Count
    End If
End Function

' Renvoie l'index (1..n) d'une ligne libre : réutilise la ligne réservée vide.
Public Function NouvelleLigne(ByVal lo As ListObject) As Long
    If lo.ListRows.Count = 0 Then
        NouvelleLigne = lo.ListRows.Add.Index
    ElseIf EstVide(lo) Then
        NouvelleLigne = 1
    Else
        NouvelleLigne = lo.ListRows.Add(AlwaysInsert:=True).Index
    End If
End Function

Public Function Valeur(ByVal lo As ListObject, ByVal i As Long, ByVal entete As String) As Variant
    Valeur = lo.DataBodyRange.Cells(i, Col(lo, entete)).Value
End Function

Public Sub Ecrire(ByVal lo As ListObject, ByVal i As Long, ByVal entete As String, ByVal v As Variant)
    lo.DataBodyRange.Cells(i, Col(lo, entete)).Value = v
End Sub

Public Function Colonne(ByVal lo As ListObject, ByVal entete As String) As Variant
    Dim v As Variant, t() As Variant
    v = lo.ListColumns(entete).DataBodyRange.Value
    If IsArray(v) Then
        Colonne = v
    Else
        ReDim t(1 To 1, 1 To 1)
        t(1, 1) = v
        Colonne = t
    End If
End Function

Public Function TrouverLigne(ByVal lo As ListObject, ByVal entete As String, ByVal v As Variant) As Long
    Dim a As Variant, i As Long, cible As String
    If NombreLignes(lo) = 0 Then Exit Function
    a = Colonne(lo, entete)
    cible = LCase$(Trim$(CStr(v)))
    For i = 1 To UBound(a, 1)
        If Not IsError(a(i, 1)) Then
            If LCase$(Trim$(CStr(a(i, 1)))) = cible Then
                TrouverLigne = i
                Exit Function
            End If
        End If
    Next i
End Function

Public Function ValeurDans(ByVal lo As ListObject, ByVal enteteCle As String, ByVal cle As Variant, _
                           ByVal enteteVal As String) As Variant
    Dim i As Long
    i = TrouverLigne(lo, enteteCle, cle)
    If i > 0 Then ValeurDans = Valeur(lo, i, enteteVal) Else ValeurDans = Empty
End Function

' Vide un tableau en gardant une ligne réservée (formules conservées).
Public Sub ViderTable(ByVal lo As ListObject)
    Dim c As Range
    If lo.ListRows.Count = 0 Then Exit Sub
    If lo.ListRows.Count > 1 Then
        lo.DataBodyRange.Offset(1, 0).Resize(lo.ListRows.Count - 1).Delete Shift:=-4162
    End If
    For Each c In lo.DataBodyRange.Rows(1).Cells
        If Not c.HasFormula Then c.ClearContents
    Next c
End Sub

' ---------- Noms et champs ----------
Public Function Nom(ByVal n As String) As Variant
    Dim v As Variant
    v = ThisWorkbook.Worksheets("_Config").Evaluate(n)
    If IsError(v) Then Err.Raise vbObjectError + 3, , "Nom invalide : " & n
    Nom = v
End Function

Public Function Champ(ByVal n As String) As Variant
    Champ = ThisWorkbook.Names(n).RefersToRange.Value
End Function

Public Sub DefinirChamp(ByVal n As String, ByVal v As Variant)
    ThisWorkbook.Names(n).RefersToRange.Value = v
End Sub

Public Function FeuilleDe(ByVal n As String) As Worksheet
    Set FeuilleDe = ThisWorkbook.Names(n).RefersToRange.Worksheet
End Function

' Efface les cellules de saisie (noms commençant par prefixe), sauf les formules.
Public Sub EffacerFormulaire(ByVal prefixe As String)
    Dim nm As Name, r As Range
    For Each nm In ThisWorkbook.Names
        If Left$(nm.Name, Len(prefixe)) = prefixe Then
            Set r = Nothing
            On Error Resume Next
            Set r = nm.RefersToRange
            On Error GoTo 0
            If Not r Is Nothing Then
                If Not r.HasFormula Then r.ClearContents
            End If
        End If
    Next nm
End Sub

' ---------- Messages ----------
Public Function ModeTest() As Boolean
    On Error Resume Next
    ModeTest = CBool(Champ("CFG_ModeTest"))
End Function

Private Sub Journaliser(ByVal msg As String)
    DefinirChamp "CFG_DernierMessage", msg
    DefinirChamp "CFG_Journal", Left$(CStr(Champ("CFG_Journal")) & msg & " || ", 30000)
End Sub

Public Sub Notifier(ByVal msg As String)
    If ModeTest() Then
        Journaliser msg
    Else
        MsgBox msg, vbInformation, "Gestion Ecole"
    End If
End Sub

Public Function Confirmer(ByVal msg As String) As Boolean
    If ModeTest() Then
        Journaliser msg
        Confirmer = (LCase$(CStr(Champ("CFG_ReponseTest"))) = "oui")
    Else
        Confirmer = (MsgBox(msg, vbYesNo + vbQuestion, "Gestion Ecole") = vbYes)
    End If
End Function

' ---------- Performance ----------
Public Sub Debut()
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.Calculation = -4135   ' xlCalculationManual
End Sub

Public Sub Fin()
    Application.Calculation = -4105   ' xlCalculationAutomatic
    Application.EnableEvents = True
    Application.ScreenUpdating = True
End Sub

' ---------- Fichiers ----------
Public Function Dossier(ByVal sous As String) As String
    Dim base As String, sep As String, p As String
    sep = Application.PathSeparator
    base = Trim$(CStr(Champ("CFG_DossierSortie")))
    If base = "" Then base = ThisWorkbook.Path
    If Right$(base, 1) = sep Then base = Left$(base, Len(base) - 1)
    p = base & sep & sous
    On Error Resume Next
    MkDir p
    On Error GoTo 0
    Dossier = p & sep
End Function

Public Function NomFichier(ByVal s As String) As String
    Dim interdits As String, i As Long
    interdits = "/\:*?""<>|"
    For i = 1 To Len(interdits)
        s = Replace(s, Mid$(interdits, i, 1), "-")
    Next i
    NomFichier = Trim$(s)
End Function

' ---------- Saisie ----------
Public Function LireMontant(ByVal v As Variant) As Double
    Dim s As String
    s = CStr(v)
    s = Replace(s, " ", "")
    s = Replace(s, ChrW(160), "")
    s = Replace(s, ChrW(8239), "")
    s = Replace(s, "FCFA", "", , , vbTextCompare)
    If s = "" Or Not IsNumeric(s) Then
        LireMontant = -1
    Else
        LireMontant = CDbl(s)
    End If
End Function

Public Function MatriculeDe(ByVal libelle As String) As String
    Dim p As Long
    p = InStr(libelle, " - ")
    If p > 0 Then MatriculeDe = Left$(libelle, p - 1) Else MatriculeDe = Trim$(libelle)
End Function

' ---------- Mois ----------
Private Function IndexDans(ByVal nomListe As String, ByVal v As String) As Long
    Dim r As Range, i As Long
    Set r = ThisWorkbook.Names(nomListe).RefersToRange
    For i = 1 To r.Rows.Count
        If LCase$(CStr(r.Cells(i, 1).Value)) = LCase$(Trim$(v)) Then
            IndexDans = i
            Exit Function
        End If
    Next i
End Function

Public Function IndexMois(ByVal m As String) As Long
    IndexMois = IndexDans("L_Mois", m)
End Function

Public Function IndexMois12(ByVal m As String) As Long
    IndexMois12 = IndexDans("L_Mois12", m)
End Function

Public Function MoisNom(ByVal i As Long) As String
    MoisNom = CStr(ThisWorkbook.Names("L_Mois").RefersToRange.Cells(i, 1).Value)
End Function

Public Function MoisNom12(ByVal i As Long) As String
    MoisNom12 = CStr(ThisWorkbook.Names("L_Mois12").RefersToRange.Cells(i, 1).Value)
End Function

' ---------- Hooks de test ----------
Public Sub Ping()
    Notifier "pong"
End Sub

Public Sub TestAccents()
    Notifier "Élève à jour — reçu"
End Sub

Public Sub TestInfoBouton(ByVal feuille As String, ByVal texte As String)
    Dim b As Object
    For Each b In ThisWorkbook.Worksheets(feuille).Buttons
        If b.Caption = texte Then Notifier CStr(b.OnAction): Exit Sub
    Next b
    Notifier "absent"
End Sub

Public Sub TestClicBouton(ByVal feuille As String, ByVal texte As String)
    Dim b As Object
    For Each b In ThisWorkbook.Worksheets(feuille).Buttons
        If b.Caption = texte Then Application.Run CStr(b.OnAction): Exit Sub
    Next b
    Notifier "absent"
End Sub

Public Sub TestNouvelleLigne(ByVal nomTable As String)
    Notifier CStr(NouvelleLigne(Tbl(nomTable)))
End Sub

Public Sub TestExisteForme(ByVal feuille As String, ByVal nomForme As String)
    Dim s As Object, n As Long
    For Each s In ThisWorkbook.Worksheets(feuille).Shapes
        If s.Name = nomForme Then n = n + 1
    Next s
    Notifier CStr(n)
End Sub
```

- [ ] **Step 7 : pilote Excel et build**

`excel/gen/excel_driver.py` :
```python
"""Pilote Excel Mac via xlwings."""
import xlwings as xw


def excel_app():
    if xw.apps.count:
        return xw.apps.active
    return xw.App(visible=True, add_book=False)


def run_builder(builder, src, vba_dir, out, guide, log):
    app = excel_app()
    app.display_alerts = False
    if log.exists():
        log.unlink()
    book = app.books.open(str(builder))
    try:
        book.macro("Construire")(str(src), str(vba_dir) + "/", str(out), str(guide), str(log))
    finally:
        book.close()
    result = log.read_text(encoding="utf-8", errors="replace").strip() if log.exists() else "pas de journal"
    if result != "OK":
        raise RuntimeError(f"Builder : {result}")
```

`excel/gen/build.py` :
```python
"""Construit excel/dist/Gestion Ecole.xlsm.  Usage (depuis excel/) : .venv/bin/python -m gen.build"""
import shutil

from . import paths
from .book import Book
from .excel_driver import run_builder
from .sheets import accueil, config
from .vba_ascii import convert_file

# Ordre des onglets. _Config est toujours ajoutée en dernier par config.build.
SHEET_BUILDERS = [
    accueil.build,
]

# Ordre d'import des modules VBA.
MODULES = ["modUtil.bas"]

GUIDE = False  # passe à True en Task 13 (feuille Aide)


def build_xlsx(path):
    book = Book(path)
    for m in MODULES:
        book.module(m)
    for builder in SHEET_BUILDERS:
        builder(book)
    config.build(book)
    book.close()


def main():
    shutil.rmtree(paths.STAGE, ignore_errors=True)
    (paths.STAGE / "vba").mkdir(parents=True)
    xlsx = paths.STAGE / "GestionEcole.xlsx"
    build_xlsx(xlsx)
    for m in MODULES:
        convert_file(paths.VBA_SRC / m, paths.STAGE / "vba" / m)
    builder = paths.WORK / "tools" / "Builder.xlsm"
    builder.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(paths.BUILDER_SRC, builder)
    out = paths.STAGE / "Gestion Ecole.xlsm"
    guide = paths.STAGE / "Guide.pdf" if GUIDE else ""
    run_builder(builder, xlsx, paths.STAGE / "vba", out, guide, paths.STAGE / "build.log")
    paths.DIST.mkdir(exist_ok=True)
    shutil.copy(out, paths.DIST_XLSM)
    if GUIDE:
        shutil.copy(guide, paths.DIST_GUIDE)
    print("OK ->", paths.DIST_XLSM)


if __name__ == "__main__":
    main()
```

- [ ] **Step 8 : helpers de test et fixture**

`excel/tests/helpers.py` :
```python
"""Pilotage du classeur testé."""
from pathlib import Path


class Gestion:
    def __init__(self, book, folder: Path):
        self.book = book
        self.dir = folder
        self._sheets = None

    # --- noms / macros ---
    def has_name(self, name):
        return any(n.name == name for n in self.book.names)

    def get(self, name):
        return self.book.names[name].refers_to_range.value

    def set(self, name, value):
        self.book.names[name].refers_to_range.value = value

    def fill(self, values: dict):
        for k, v in values.items():
            self.set(k, v)

    def run(self, macro, *args):
        return self.book.macro(macro)(*args)

    def message(self):
        return self.get("CFG_DernierMessage") or ""

    def eval(self, expr):
        c = self.book.sheets["_Config"].range("AZ1")
        c.formula = "=" + expr
        v = c.value
        c.clear_contents()
        return v

    # --- tableaux ---
    def _table_sheet(self, table):
        if table == "tblTables":
            return "_Config"
        if self._sheets is None:
            self._sheets = {r["Table"]: r["Feuille"] for r in self.rows("tblTables")}
        return self._sheets[table]

    def _geometry(self, table):
        r0 = int(self.eval(f"ROW({table}[#All])"))
        c0 = int(self.eval(f"COLUMN({table}[#All])"))
        nr = int(self.eval(f"ROWS({table}[#All])"))
        nc = int(self.eval(f"COLUMNS({table}[#All])"))
        return r0, c0, nr, nc

    def _values(self, table):
        r0, c0, nr, nc = self._geometry(table)
        sh = self.book.sheets[self._table_sheet(table)]
        vals = sh.range((r0, c0), (r0 + nr - 1, c0 + nc - 1)).value
        if nc == 1:
            vals = [[v] for v in vals]
        return vals

    def rows(self, table):
        """Lignes de données non vides (la ligne réservée vide est ignorée)."""
        header, *data = self._values(table)
        return [dict(zip(header, r)) for r in data if r[0] not in (None, "")]

    def find(self, table, header, value):
        """Index 1-based de la ligne (comptée dans le tableau), 0 si absente."""
        header_row, *data = self._values(table)
        j = header_row.index(header)
        for i, r in enumerate(data, 1):
            if r[j] == value:
                return i
        return 0

    def cell(self, table, idx, header):
        r0, c0, _, _ = self._geometry(table)
        header_row = self._values(table)[0]
        sh = self.book.sheets[self._table_sheet(table)]
        return sh.range((r0 + idx, c0 + header_row.index(header)))

    def set_row(self, table, idx, values: dict):
        for h, v in values.items():
            self.cell(table, idx, h).value = v

    def add_row(self, table, values: dict):
        self.run("modUtil.TestNouvelleLigne", table)
        idx = int(float(self.message()))
        self.set_row(table, idx, values)
        return idx
```

`excel/tests/conftest.py` :
```python
import shutil
from datetime import datetime

import pytest

from gen import paths
from gen.excel_driver import excel_app
from helpers import Gestion

DATE_REF = datetime(2027, 1, 15)


@pytest.fixture
def g(request):
    if not paths.DIST_XLSM.exists():
        pytest.fail("Construire d'abord : .venv/bin/python -m gen.build")
    folder = paths.RUNS / request.node.name[:60]
    shutil.rmtree(folder, ignore_errors=True)
    folder.mkdir(parents=True)
    path = folder / "Gestion Ecole.xlsm"
    shutil.copy(paths.DIST_XLSM, path)
    app = excel_app()
    app.display_alerts = False
    book = app.books.open(str(path))
    gest = Gestion(book, folder)
    gest.set("CFG_ModeTest", True)
    gest.set("CFG_ReponseTest", "Oui")
    if gest.has_name("DateReference"):
        gest.set("DateReference", DATE_REF)
    yield gest
    try:
        book.close()
    except Exception:
        pass
```
`excel/tests/__init__.py` n'est pas créé (le `pythonpath` de `pytest.ini` rend `gen` et `helpers` importables).

- [ ] **Step 9 : Builder**

`excel/tools/Builder.bas` (ASCII uniquement — collé à la main dans Builder.xlsm, voir Step 0) :
```vba
Option Explicit
' Builder Gestion Ecole : importe les modules VBA, cree les boutons, enregistre le .xlsm.
' Appele par excel/gen/excel_driver.py. Resultat ecrit dans le fichier journal.

Public Sub Construire(ByVal source As String, ByVal dossierVba As String, ByVal sortie As String, _
                      ByVal guidePdf As String, ByVal journal As String)
    Dim wb As Workbook, lo As ListObject, i As Long, etape As String
    On Error GoTo Echec
    Application.DisplayAlerts = False
    Application.EnableEvents = False
    etape = "ouverture"
    Set wb = Workbooks.Open(source)
    Set lo = wb.Worksheets("_Config").ListObjects("tblModules")
    For i = 1 To lo.ListRows.Count
        If Trim$(CStr(lo.DataBodyRange.Cells(i, 1).Value)) <> "" Then
            etape = "module " & lo.DataBodyRange.Cells(i, 1).Value
            ImporterModule wb, dossierVba, CStr(lo.DataBodyRange.Cells(i, 1).Value)
        End If
    Next i
    etape = "enregistrement xlsm"
    wb.SaveAs Filename:=sortie, FileFormat:=52
    etape = "boutons"
    CreerBoutons wb
    etape = "calcul"
    Application.CalculateFull
    If guidePdf <> "" Then
        etape = "guide pdf"
        wb.Worksheets("Aide").ExportAsFixedFormat Type:=0, Filename:=guidePdf
    End If
    wb.Worksheets(1).Activate
    wb.Save
    wb.Close SaveChanges:=False
    Application.EnableEvents = True
    Application.DisplayAlerts = True
    EcrireTexte journal, "OK"
    Exit Sub
Echec:
    EcrireTexte journal, "ERREUR (" & etape & ") : " & Err.Number & " " & Err.Description
    Application.EnableEvents = True
    Application.DisplayAlerts = True
    On Error Resume Next
    If Not wb Is Nothing Then wb.Close SaveChanges:=False
End Sub

Private Sub ImporterModule(ByVal wb As Workbook, ByVal dossier As String, ByVal fichier As String)
    Dim code As String, nom As String, comp As Object, cm As Object
    code = LireTexte(dossier & fichier)
    nom = Left$(fichier, InStrRev(fichier, ".") - 1)
    If nom = "ThisWorkbook" Then
        Set comp = ComposantClasseur(wb)
    Else
        Set comp = wb.VBProject.VBComponents.Add(1)
        comp.Name = nom
    End If
    Set cm = comp.CodeModule
    If cm.CountOfLines > 0 Then cm.DeleteLines 1, cm.CountOfLines
    cm.AddFromString code
End Sub

Private Function ComposantClasseur(ByVal wb As Workbook) As Object
    Dim comp As Object, ws As Worksheet, estFeuille As Boolean
    For Each comp In wb.VBProject.VBComponents
        If comp.Type = 100 Then
            estFeuille = False
            For Each ws In wb.Worksheets
                If ws.CodeName = comp.Name Then estFeuille = True
            Next ws
            If Not estFeuille Then
                Set ComposantClasseur = comp
                Exit Function
            End If
        End If
    Next comp
    Err.Raise vbObjectError + 2, , "Module ThisWorkbook introuvable"
End Function

Private Sub CreerBoutons(ByVal wb As Workbook)
    Dim lo As ListObject, i As Long, ws As Worksheet, r As Range, b As Object
    Set lo = wb.Worksheets("_Config").ListObjects("tblBoutons")
    For i = 1 To lo.ListRows.Count
        If Trim$(CStr(lo.DataBodyRange.Cells(i, 1).Value)) <> "" Then
            Set ws = wb.Worksheets(CStr(lo.DataBodyRange.Cells(i, 1).Value))
            Set r = ws.Range(CStr(lo.DataBodyRange.Cells(i, 2).Value))
            Set b = ws.Buttons.Add(r.Left, r.Top, CDbl(lo.DataBodyRange.Cells(i, 3).Value), 26)
            b.Name = "btn" & i
            b.Caption = CStr(lo.DataBodyRange.Cells(i, 4).Value)
            b.OnAction = CStr(lo.DataBodyRange.Cells(i, 5).Value)
        End If
    Next i
End Sub

Private Function LireTexte(ByVal chemin As String) As String
    Dim f As Integer, s As String
    f = FreeFile
    Open chemin For Binary Access Read As #f
    s = Space$(LOF(f))
    Get #f, , s
    Close #f
    LireTexte = s
End Function

Private Sub EcrireTexte(ByVal chemin As String, ByVal s As String)
    Dim f As Integer
    f = FreeFile
    Open chemin For Output As #f
    Print #f, s
    Close #f
End Sub
```
Ensuite, faire réaliser le Step 0 par l'utilisateur (création de `excel/tools/Builder.xlsm`) et attendre sa confirmation.

- [ ] **Step 10 : test du pipeline (doit échouer avant le build)**

`excel/tests/test_pipeline.py` :
```python
def test_module_importe_et_macro_executable(g):
    g.run("modUtil.Ping")
    assert g.message() == "pong"


def test_accents_dans_vba(g):
    g.run("modUtil.TestAccents")
    assert g.message() == "Élève à jour — reçu"


def test_bouton_cree_et_relie(g):
    g.run("modUtil.TestInfoBouton", "_Config", "Ping")
    action = g.message()
    assert "Ping" in action and ".xlsx" not in action
    g.set("CFG_DernierMessage", "")
    g.run("modUtil.TestClicBouton", "_Config", "Ping")
    assert g.message() == "pong"


def test_lecture_tableau(g):
    assert {"Fichier": "modUtil.bas"} in g.rows("tblModules")


def test_nouvelle_ligne_reutilise_la_ligne_reservee(g):
    # tblModules a 1 ligne pleine : la nouvelle ligne est la 2e
    g.run("modUtil.TestNouvelleLigne", "tblModules")
    assert g.message() == "2"
```
Run: `cd excel && .venv/bin/python -m pytest tests/test_pipeline.py`
Expected: FAIL « Construire d'abord ».

- [ ] **Step 11 : construire et tester**

Run: `cd excel && .venv/bin/python -m gen.build && .venv/bin/python -m pytest`
Expected: `OK -> .../excel/dist/Gestion Ecole.xlsm` puis tous les tests passent (11 passed).
Si le Builder échoue sur `VBComponents.Add` : vérifier le réglage « Faire confiance à l'accès au modèle d'objet du projet VBA » (Step 0) ; le message d'erreur est dans `~/Library/Group Containers/UBF8T346G9.Office/GestionEcole/stage/build.log`.

- [ ] **Step 12 : README développeur**

`excel/README.md` :
```markdown
# Gestion Ecole — version Excel

Classeur livré : `dist/Gestion Ecole.xlsm` (cible : Excel Windows).

## Prérequis (poste de construction, Mac)
- Excel Mac avec : Réglages → Sécurité → « Faire confiance à l'accès au modèle d'objet du projet VBA » et « Activer toutes les macros ».
- `tools/Builder.xlsm` (créé une fois à partir de `tools/Builder.bas`).
- `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`

## Construire
    .venv/bin/python -m gen.build

## Tester (Excel s'ouvre et se pilote seul — ne pas l'utiliser pendant les tests)
    .venv/bin/python -m pytest

## Organisation
- `gen/` : génération de la structure (XlsxWriter). Une feuille = une fonction `build_*` listée dans `gen/build.py` (`SHEET_BUILDERS`).
- `vba/` : modules VBA (UTF-8 ; les accents des chaînes sont convertis en `ChrW` au build). Liste d'import : `MODULES` dans `gen/build.py`.
- Les messages VBA passent par `Notifier`/`Confirmer` ; en mode test (`CFG_ModeTest`), ils sont écrits dans `_Config` au lieu d'ouvrir une fenêtre.
```

- [ ] **Step 13 : commit**

```bash
git add excel/
git commit -m "feat(excel): chaîne de construction et de test Gestion Ecole"
```

---

### Task 2: Paramètres et référentiels

**Files:**
- Create: `excel/gen/sheets/parametres.py`
- Modify: `excel/gen/build.py` (SHEET_BUILDERS)
- Test: `excel/tests/test_parametres.py`

**Interfaces:**
- Consumes: `Book` (Task 1).
- Produces: feuille « Paramètres » ; noms `Ecole_Nom`, `Ecole_Adresse`, `Ecole_Tel1`, `Ecole_Tel2`, `Ecole_Email`, `Ecole_Logo`, `Prefixe_Matricule`, `Prefixe_Recu`, `Prefixe_Employe`, `AnneeActive` (texte « 2026-2027 »), `DateReference`, `AnneeDebut` (nombre), `DateCalcul`, `MoisEcoules` (0…10) ; tableaux `tblAnnees` (Libellé, Date début, Date fin), `tblNiveaux` (Niveau, Ordre), `tblTypesFrais` (Type de frais, Montant par défaut, Obligatoire, Périodicité), `tblCatDepenses` (Catégorie), `tblCatRecettes` (Catégorie), `tblMatieres` (Matière, Coefficient, Niveau) ; listes `L_Annees`, `L_Niveaux`, `L_TypesFrais`, `L_CatDepenses`, `L_CatRecettes`.

- [ ] **Step 1 : test (doit échouer)**

`excel/tests/test_parametres.py` :
```python
from datetime import datetime

import pytest


def test_annee_active(g):
    assert g.get("AnneeActive") == "2026-2027"
    assert g.eval("AnneeDebut") == 2026


@pytest.mark.parametrize("jour,attendu", [
    (datetime(2026, 9, 20), 0),   # avant la rentrée
    (datetime(2026, 10, 1), 1),
    (datetime(2027, 1, 15), 4),
    (datetime(2027, 7, 31), 10),
    (datetime(2027, 8, 10), 10),  # après juillet : borné
])
def test_mois_ecoules(g, jour, attendu):
    g.set("DateReference", jour)
    assert g.eval("MoisEcoules") == attendu


def test_types_de_frais(g):
    types = {r["Type de frais"]: r for r in g.rows("tblTypesFrais")}
    assert types["Scolarité"]["Montant par défaut"] == 25000
    assert types["Scolarité"]["Périodicité"] == "Mensuel"
    assert types["Inscription"]["Obligatoire"] == "Oui"
    assert types["Inscription"]["Périodicité"] == "Unique"
    assert types["Transport"]["Obligatoire"] == "Non"
    assert g.eval("ROWS(L_TypesFrais)") == 5


def test_prefixes_et_ecole(g):
    assert g.get("Prefixe_Matricule") == "ELV"
    assert g.get("Prefixe_Recu") == "REC"
    assert g.get("Prefixe_Employe") == "EMP"
    assert g.get("Ecole_Nom") == "Mon École"


def test_referentiels(g):
    assert [r["Niveau"] for r in g.rows("tblNiveaux")] == ["Crèche", "Préscolaire", "Élémentaire", "Moyen"]
    assert len(g.rows("tblCatDepenses")) == 4
    assert len(g.rows("tblMatieres")) == 7
```
Run: `cd excel && .venv/bin/python -m pytest tests/test_parametres.py`
Expected: FAIL (`AnneeActive` absent).

- [ ] **Step 2 : feuille Paramètres**

`excel/gen/sheets/parametres.py` :
```python
from datetime import datetime

SHEET = "Paramètres"

ECOLE = [  # (ligne Excel, libellé, nom, valeur par défaut, format)
    (3, "Nom de l'école", "Ecole_Nom", "Mon École", "input"),
    (4, "Adresse", "Ecole_Adresse", "", "input"),
    (5, "Téléphone 1", "Ecole_Tel1", "", "input_text"),
    (6, "Téléphone 2", "Ecole_Tel2", "", "input_text"),
    (7, "Email", "Ecole_Email", "", "input"),
    (8, "Logo (chemin du fichier image)", "Ecole_Logo", "", "input"),
    (10, "Préfixe matricule élève", "Prefixe_Matricule", "ELV", "input"),
    (11, "Préfixe reçu", "Prefixe_Recu", "REC", "input"),
    (12, "Préfixe employé", "Prefixe_Employe", "EMP", "input"),
]

NIVEAUX = [("Crèche", 1), ("Préscolaire", 2), ("Élémentaire", 3), ("Moyen", 4)]
TYPES_FRAIS = [  # (nom, montant, obligatoire, périodicité) — repris du seed de l'app
    ("Scolarité", 25000, "Oui", "Mensuel"),
    ("Inscription", 50000, "Oui", "Unique"),
    ("Tenue", 15000, "Non", "Unique"),
    ("Fourniture", 10000, "Non", "Unique"),
    ("Transport", 15000, "Non", "Mensuel"),
]
CAT_DEPENSES = ["Fournitures", "Entretien", "Équipement", "Divers"]
CAT_RECETTES = ["Location salle", "Événements", "Dons", "Divers"]
MATIERES = [
    ("Français", 3, "Élémentaire"), ("Mathématiques", 3, "Élémentaire"),
    ("Éveil", 2, "Élémentaire"), ("Éducation physique", 1, "Élémentaire"),
    ("Activités d'éveil", 2, "Préscolaire"), ("Langage", 2, "Préscolaire"),
    ("Psychomotricité", 1, "Crèche"),
]


def build(book):
    f = book.f
    ws = book.sheet(SHEET, "Paramètres")
    ws.set_column(0, 0, 32)
    ws.set_column(1, 1, 30)
    for row, label, name, default, fmt in ECOLE:
        ws.write(row - 1, 0, label, f["label"])
        ws.write(row - 1, 1, default, f[fmt])
        book.cell_name(name, SHEET, f"B{row}")
    ws.write(13, 0, "Année scolaire active", f["label"])
    ws.write(13, 1, "2026-2027", f["label"])
    ws.write(13, 2, "Modifiée uniquement par « Nouvelle année scolaire ».", f["info"])
    book.cell_name("AnneeActive", SHEET, "B14")
    ws.write(14, 0, "Date de référence (vide = aujourd'hui)", f["label"])
    ws.write_blank(14, 1, None, f["input_date"])
    book.cell_name("DateReference", SHEET, "B15")
    book.name("AnneeDebut", "=VALUE(LEFT(AnneeActive,4))")
    book.name("DateCalcul", f"=IF('{SHEET}'!$B$15=\"\",TODAY(),'{SHEET}'!$B$15)")
    book.name("MoisEcoules", "=MAX(0,MIN(10,(YEAR(DateCalcul)-AnneeDebut)*12+MONTH(DateCalcul)-9))")

    top = 17
    ws.write(top - 1, 0, "Années scolaires", f["h2"])
    book.table(SHEET, "tblAnnees", top, 0,
               [{"h": "Libellé", "w": 32}, {"h": "Date début", "fmt": "date", "w": 30},
                {"h": "Date fin", "fmt": "date", "w": 12}],
               [{"Libellé": "2026-2027", "Date début": datetime(2026, 10, 1),
                 "Date fin": datetime(2027, 7, 31)}])
    ws.write(top - 1, 4, "Niveaux", f["h2"])
    book.table(SHEET, "tblNiveaux", top, 4, [{"h": "Niveau", "w": 16}, {"h": "Ordre", "w": 8}],
               [{"Niveau": n, "Ordre": o} for n, o in NIVEAUX])
    ws.write(top - 1, 7, "Types de frais", f["h2"])
    book.table(SHEET, "tblTypesFrais", top, 7,
               [{"h": "Type de frais", "w": 16}, {"h": "Montant par défaut", "fmt": "money", "w": 18},
                {"h": "Obligatoire", "list": "L_OuiNon", "w": 12},
                {"h": "Périodicité", "list": "L_Periodicite", "w": 12}],
               [{"Type de frais": n, "Montant par défaut": m, "Obligatoire": o, "Périodicité": p}
                for n, m, o, p in TYPES_FRAIS])
    ws.write(top - 1, 12, "Catégories de dépenses", f["h2"])
    book.table(SHEET, "tblCatDepenses", top, 12, [{"h": "Catégorie", "w": 22}],
               [{"Catégorie": c} for c in CAT_DEPENSES])
    ws.write(top - 1, 14, "Catégories de recettes", f["h2"])
    book.table(SHEET, "tblCatRecettes", top, 14, [{"h": "Catégorie", "w": 22}],
               [{"Catégorie": c} for c in CAT_RECETTES])
    ws.write(top - 1, 16, "Matières", f["h2"])
    book.table(SHEET, "tblMatieres", top, 16,
               [{"h": "Matière", "w": 20}, {"h": "Coefficient", "w": 11},
                {"h": "Niveau", "list": "L_Niveaux", "w": 14}],
               [{"Matière": m, "Coefficient": c, "Niveau": n} for m, c, n in MATIERES])

    book.name("L_Annees", "=tblAnnees[Libellé]")
    book.name("L_Niveaux", "=tblNiveaux[Niveau]")
    book.name("L_TypesFrais", "=tblTypesFrais[Type de frais]")
    book.name("L_CatDepenses", "=tblCatDepenses[Catégorie]")
    book.name("L_CatRecettes", "=tblCatRecettes[Catégorie]")
```

Dans `excel/gen/build.py`, remplacer l'import et la liste :
```python
from .sheets import accueil, config, parametres

SHEET_BUILDERS = [
    accueil.build,
    parametres.build,
]
```

- [ ] **Step 3 : construire et tester**

Run: `cd excel && .venv/bin/python -m gen.build && .venv/bin/python -m pytest`
Expected: tous les tests passent.

- [ ] **Step 4 : commit**

```bash
git add excel/
git commit -m "feat(excel): feuille Paramètres et référentiels"
```

---
### Task 3: Classes, Élèves et Inscription

**Files:**
- Create: `excel/gen/sheets/scolarite.py`, `excel/vba/modIds.bas`, `excel/vba/modEleves.bas`
- Modify: `excel/gen/build.py` (SHEET_BUILDERS, MODULES)
- Test: `excel/tests/test_inscription.py`, `excel/tests/helpers.py` (ajout `inscrire`)

**Interfaces:**
- Consumes: modUtil (Task 1) ; `AnneeActive`, `AnneeDebut`, `Prefixe_Matricule`, `L_Niveaux` (Task 2).
- Produces:
  - `tblClasses` (Classe, Niveau, Capacité, Classe suivante, Effectif, Places restantes) ; liste `L_Classes`.
  - `tblEleves` (Matricule, Prénom, Nom, Date naissance, Lieu naissance, Sexe, Adresse, Classe, Année, Statut, Date inscription, Parent prénom, Parent nom, Relation, Téléphone, Téléphone 2, Profession, Adresse parent, Contact 2 nom, Contact 2 relation, Contact 2 téléphone, Libellé, Niveau, Rang classe, Clé classe, Rang actif) ; liste `L_Eleves` (= Libellé « MAT - Prénom Nom »).
  - Cellules `INS_*` de la feuille Inscription.
  - VBA `modIds.NextMatricule() As String` ; `modEleves.Inscrire`, `modEleves.EffacerInscription`.
  - Test helper `helpers.inscrire(g, **champs) -> str` (message) et `helpers.DEFAULT_ELEVE`.

- [ ] **Step 1 : tests (doivent échouer)**

Ajouter à la fin de `excel/tests/helpers.py` :
```python
from datetime import datetime

DEFAULT_ELEVE = dict(
    INS_Prenom="Awa", INS_Nom="Diop", INS_DateNaissance=datetime(2019, 3, 12), INS_Sexe="F",
    INS_Classe="CI", INS_ParentPrenom="Moussa", INS_ParentNom="Diop", INS_Relation="Père",
    INS_Tel="+221 77 123 45 67",
)


def inscrire(g, **champs):
    g.fill({**DEFAULT_ELEVE, **champs})
    g.run("modEleves.Inscrire")
    return g.message()
```

`excel/tests/test_inscription.py` :
```python
from helpers import inscrire


def test_inscription_cree_l_eleve(g):
    msg = inscrire(g)
    rows = g.rows("tblEleves")
    assert len(rows) == 1
    e = rows[0]
    assert e["Matricule"] == "ELV-2026-0001"
    assert e["Statut"] == "Actif"
    assert e["Année"] == "2026-2027"
    assert e["Téléphone"] == "+221 77 123 45 67"
    assert e["Libellé"] == "ELV-2026-0001 - Awa Diop"
    assert e["Niveau"] == "Élémentaire"
    assert "ELV-2026-0001" in msg
    assert g.get("INS_Prenom") is None  # formulaire vidé


def test_matricules_sequentiels(g):
    for prenom in ["Awa", "Binta", "Cheikh"]:
        inscrire(g, INS_Prenom=prenom)
    assert [r["Matricule"] for r in g.rows("tblEleves")] == [
        "ELV-2026-0001", "ELV-2026-0002", "ELV-2026-0003"]


def test_champ_obligatoire_manquant(g):
    msg = inscrire(g, INS_Nom=None)
    assert "Nom" in msg
    assert g.rows("tblEleves") == []


def test_date_de_naissance_invalide(g):
    msg = inscrire(g, INS_DateNaissance="abc")
    assert msg == "Date de naissance invalide."
    assert g.rows("tblEleves") == []


def test_effectif_et_places(g):
    inscrire(g)
    inscrire(g, INS_Prenom="Binta")
    ci = next(r for r in g.rows("tblClasses") if r["Classe"] == "CI")
    assert ci["Effectif"] == 2
    assert ci["Places restantes"] == 33


def test_classe_pleine(g):
    g.cell("tblClasses", g.find("tblClasses", "Classe", "CI"), "Capacité").value = 1
    inscrire(g)
    g.set("CFG_ReponseTest", "Non")
    msg = inscrire(g, INS_Prenom="Binta")
    assert "pleine" in msg
    assert len(g.rows("tblEleves")) == 1
    g.set("CFG_ReponseTest", "Oui")
    inscrire(g, INS_Prenom="Binta")
    assert len(g.rows("tblEleves")) == 2


def test_accents_et_apostrophes(g):
    inscrire(g, INS_Prenom="Ndèye", INS_Nom="N'Diaye")
    e = g.rows("tblEleves")[0]
    assert e["Prénom"] == "Ndèye" and e["Nom"] == "N'Diaye"
    assert e["Libellé"] == "ELV-2026-0001 - Ndèye N'Diaye"


def test_eleve_inactif_hors_effectif(g):
    inscrire(g)
    g.cell("tblEleves", 1, "Statut").value = "Inactif"
    ci = next(r for r in g.rows("tblClasses") if r["Classe"] == "CI")
    assert ci["Effectif"] == 0


def test_classes_initiales(g):
    classes = {r["Classe"]: r for r in g.rows("tblClasses")}
    assert len(classes) == 13
    assert classes["CM2"]["Classe suivante"] == "6ème"
    assert classes["3ème"]["Classe suivante"] is None
```
Run: `cd excel && .venv/bin/python -m pytest tests/test_inscription.py`
Expected: FAIL (`INS_Prenom` absent).

- [ ] **Step 2 : feuilles Inscription, Élèves, Classes**

`excel/gen/sheets/scolarite.py` :
```python
CLASSES = [  # (classe, niveau, capacité, classe suivante) — reprises du seed de l'app
    ("Petite Section", "Crèche", 20, "Moyenne Section"),
    ("Moyenne Section", "Crèche", 20, "Grande Section"),
    ("Grande Section", "Préscolaire", 25, "CI"),
    ("CI", "Élémentaire", 35, "CP"),
    ("CP", "Élémentaire", 35, "CE1"),
    ("CE1", "Élémentaire", 35, "CE2"),
    ("CE2", "Élémentaire", 35, "CM1"),
    ("CM1", "Élémentaire", 35, "CM2"),
    ("CM2", "Élémentaire", 35, "6ème"),
    ("6ème", "Moyen", 40, "5ème"),
    ("5ème", "Moyen", 40, "4ème"),
    ("4ème", "Moyen", 40, "3ème"),
    ("3ème", "Moyen", 40, None),
]

# Colonnes calculées supplémentaires de tblClasses (ajoutées par finances.py, Task 4)
EXTRA_CLASS_COLUMNS = []

T = "tblEleves"
RANG_CLASSE = (
    f'=IF(AND({T}[@[Année]]=AnneeActive,{T}[@[Statut]]="Actif"),'
    f'COUNTIFS(INDEX({T}[Classe],1):{T}[@[Classe]],{T}[@[Classe]],'
    f'INDEX({T}[Année],1):{T}[@[Année]],AnneeActive,'
    f'INDEX({T}[Statut],1):{T}[@[Statut]],"Actif"),"")'
)
RANG_ACTIF = (
    f'=IF(AND({T}[@[Année]]=AnneeActive,{T}[@[Statut]]="Actif"),'
    f'COUNTIFS(INDEX({T}[Année],1):{T}[@[Année]],AnneeActive,'
    f'INDEX({T}[Statut],1):{T}[@[Statut]],"Actif"),"")'
)


def build_inscription(book):
    f = book.f
    s = "Inscription"
    ws = book.sheet(s, "Inscription d'un élève")
    ws.set_column(0, 0, 30)
    ws.set_column(1, 1, 32)
    ws.set_column(2, 2, 30)
    ws.write(2, 0, "Remplissez les cases jaunes (* = obligatoire) puis cliquez sur « Inscrire l'élève ».", f["info"])
    fields = [
        (5, "Élève", None, None, None),
        (6, "Prénom *", "INS_Prenom", "input", None),
        (7, "Nom *", "INS_Nom", "input", None),
        (8, "Date de naissance *", "INS_DateNaissance", "input_date", None),
        (9, "Lieu de naissance", "INS_LieuNaissance", "input", None),
        (10, "Sexe *", "INS_Sexe", "input", "L_Sexe"),
        (11, "Adresse", "INS_Adresse", "input", None),
        (12, "Classe *", "INS_Classe", "input", "L_Classes"),
        (13, "Date d'inscription (vide = aujourd'hui)", "INS_DateInscription", "input_date", None),
        (14, "Montant d'inscription payé (vide = non payé)", "INS_MontantInscription", "input_money", None),
        (16, "Parent / tuteur principal", None, None, None),
        (17, "Prénom *", "INS_ParentPrenom", "input", None),
        (18, "Nom *", "INS_ParentNom", "input", None),
        (19, "Relation *", "INS_Relation", "input", "L_Relation"),
        (20, "Téléphone *", "INS_Tel", "input_text", None),
        (21, "Téléphone 2", "INS_Tel2", "input_text", None),
        (22, "Profession", "INS_Profession", "input", None),
        (23, "Adresse", "INS_ParentAdresse", "input", None),
        (25, "Deuxième contact (facultatif)", None, None, None),
        (26, "Nom", "INS_C2Nom", "input", None),
        (27, "Relation", "INS_C2Relation", "input", "L_Relation"),
        (28, "Téléphone", "INS_C2Tel", "input_text", None),
    ]
    for row, label, name, fmt, lst in fields:
        if name is None:
            ws.write(row - 1, 0, label, f["h2"])
            continue
        ws.write(row - 1, 0, label, f["label"])
        ws.write_blank(row - 1, 1, None, f[fmt])
        book.cell_name(name, s, f"B{row}")
        if lst:
            ws.data_validation(row - 1, 1, row - 1, 1, {"validate": "list", "source": "=" + lst})
    ws.write_formula(11, 2, '=IF(INS_Classe="","","Places restantes : "&IFERROR('
                            'INDEX(tblClasses[Places restantes],MATCH(INS_Classe,tblClasses[Classe],0)),"?"))',
                     f["info"])
    book.button(s, "D6", "Inscrire l'élève", "modEleves.Inscrire", 160)
    book.button(s, "D8", "Effacer le formulaire", "modEleves.EffacerInscription", 160)


def build_eleves(book):
    s = "Élèves"
    ws = book.sheet(s, "Élèves")
    ws.write(2, 0, "Pour inscrire un élève, utilisez la feuille « Inscription ». "
                   "Vous pouvez corriger les informations directement ici.", book.f["info"])
    book.table(s, T, 3, 0, [
        {"h": "Matricule", "w": 15},
        {"h": "Prénom", "w": 16},
        {"h": "Nom", "w": 16},
        {"h": "Date naissance", "fmt": "date", "w": 13},
        {"h": "Lieu naissance", "w": 14},
        {"h": "Sexe", "list": "L_Sexe", "w": 6},
        {"h": "Adresse", "w": 22},
        {"h": "Classe", "list": "L_Classes", "w": 15},
        {"h": "Année", "w": 11},
        {"h": "Statut", "list": "L_Statut", "w": 10},
        {"h": "Date inscription", "fmt": "date", "w": 13},
        {"h": "Parent prénom", "w": 14},
        {"h": "Parent nom", "w": 14},
        {"h": "Relation", "list": "L_Relation", "w": 9},
        {"h": "Téléphone", "fmt": "text", "w": 17},
        {"h": "Téléphone 2", "fmt": "text", "w": 17},
        {"h": "Profession", "w": 14},
        {"h": "Adresse parent", "w": 20},
        {"h": "Contact 2 nom", "w": 16},
        {"h": "Contact 2 relation", "list": "L_Relation", "w": 10},
        {"h": "Contact 2 téléphone", "fmt": "text", "w": 17},
        {"h": "Libellé", "w": 30,
         "f": f'=IF({T}[@[Matricule]]="","",{T}[@[Matricule]]&" - "&{T}[@[Prénom]]&" "&{T}[@[Nom]])'},
        {"h": "Niveau", "w": 12,
         "f": f'=IFERROR(INDEX(tblClasses[Niveau],MATCH({T}[@[Classe]],tblClasses[Classe],0)),"")'},
        {"h": "Rang classe", "w": 8, "f": RANG_CLASSE},
        {"h": "Clé classe", "w": 12,
         "f": f'=IF({T}[@[Rang classe]]="","",{T}[@[Classe]]&"|"&{T}[@[Rang classe]])'},
        {"h": "Rang actif", "w": 8, "f": RANG_ACTIF},
    ])
    ws.freeze_panes(4, 3)
    book.name("L_Eleves", f"={T}[Libellé]")


def build_classes(book):
    s = "Classes"
    C = "tblClasses"
    ws = book.sheet(s, "Classes")
    ws.write(2, 0, "« Classe suivante » sert au passage à l'année suivante (vide = élèves sortants).",
             book.f["info"])
    columns = [
        {"h": "Classe", "w": 18},
        {"h": "Niveau", "list": "L_Niveaux", "w": 14},
        {"h": "Capacité", "fmt": "int", "w": 10},
        {"h": "Classe suivante", "list": "L_Classes", "w": 18},
        {"h": "Effectif", "w": 10,
         "f": f'=COUNTIFS(tblEleves[Classe],{C}[@[Classe]],tblEleves[Année],AnneeActive,tblEleves[Statut],"Actif")'},
        {"h": "Places restantes", "w": 10, "f": f"={C}[@[Capacité]]-{C}[@[Effectif]]"},
    ] + EXTRA_CLASS_COLUMNS
    book.table(s, C, 3, 0, columns,
               [{"Classe": c, "Niveau": n, "Capacité": cap, "Classe suivante": nxt}
                for c, n, cap, nxt in CLASSES])
    book.name("L_Classes", f"={C}[Classe]")
```

- [ ] **Step 3 : modIds.bas et modEleves.bas**

`excel/vba/modIds.bas` :
```vba
Option Explicit
' Numérotation automatique.

Private Function MaxSuffixe(ByVal lo As ListObject, ByVal entete As String, ByVal pfx As String) As Long
    Dim a As Variant, i As Long, s As String, n As Long
    If NombreLignes(lo) = 0 Then Exit Function
    a = Colonne(lo, entete)
    For i = 1 To UBound(a, 1)
        s = CStr(a(i, 1))
        If Left$(s, Len(pfx)) = pfx Then
            n = Val(Mid$(s, Len(pfx) + 1))
            If n > MaxSuffixe Then MaxSuffixe = n
        End If
    Next i
End Function

Public Function NextMatricule() As String
    Dim pfx As String
    pfx = CStr(Nom("Prefixe_Matricule")) & "-" & CStr(Nom("AnneeDebut")) & "-"
    NextMatricule = pfx & Format$(MaxSuffixe(Tbl("tblEleves"), "Matricule", pfx) + 1, "0000")
End Function
```

`excel/vba/modEleves.bas` :
```vba
Option Explicit
' Inscription des élèves.

Private Function ChampsInscription() As Variant
    ' (nom de la cellule, colonne de tblEleves, obligatoire)
    ChampsInscription = Array( _
        Array("INS_Prenom", "Prénom", True), _
        Array("INS_Nom", "Nom", True), _
        Array("INS_DateNaissance", "Date naissance", True), _
        Array("INS_LieuNaissance", "Lieu naissance", False), _
        Array("INS_Sexe", "Sexe", True), _
        Array("INS_Adresse", "Adresse", False), _
        Array("INS_Classe", "Classe", True), _
        Array("INS_ParentPrenom", "Parent prénom", True), _
        Array("INS_ParentNom", "Parent nom", True), _
        Array("INS_Relation", "Relation", True), _
        Array("INS_Tel", "Téléphone", True), _
        Array("INS_Tel2", "Téléphone 2", False), _
        Array("INS_Profession", "Profession", False), _
        Array("INS_ParentAdresse", "Adresse parent", False), _
        Array("INS_C2Nom", "Contact 2 nom", False), _
        Array("INS_C2Relation", "Contact 2 relation", False), _
        Array("INS_C2Tel", "Contact 2 téléphone", False))
End Function

Private Function DejaInscrit(ByVal prenom As String, ByVal nomE As String, ByVal naissance As Date) As Boolean
    Dim lo As ListObject, i As Long
    Set lo = Tbl("tblEleves")
    For i = 1 To NombreLignes(lo)
        If LCase$(CStr(Valeur(lo, i, "Prénom"))) = LCase$(prenom) And _
           LCase$(CStr(Valeur(lo, i, "Nom"))) = LCase$(nomE) Then
            If IsDate(Valeur(lo, i, "Date naissance")) Then
                If CDate(Valeur(lo, i, "Date naissance")) = naissance Then DejaInscrit = True: Exit Function
            End If
        End If
    Next i
End Function

Public Sub Inscrire()
    Dim champs As Variant, c As Variant, manquants As String, lo As ListObject
    Dim ligne As Long, mat As String, classe As String, places As Variant
    Dim dateIns As Variant, montant As Double, brut As Variant
    On Error GoTo Erreur
    champs = ChampsInscription()
    For Each c In champs
        If c(2) And Trim$(CStr(Champ(c(0)))) = "" Then manquants = manquants & vbLf & "- " & c(1)
    Next c
    If manquants <> "" Then Notifier "Champs obligatoires manquants :" & manquants: Exit Sub
    If Not IsDate(Champ("INS_DateNaissance")) Then Notifier "Date de naissance invalide.": Exit Sub
    classe = Trim$(CStr(Champ("INS_Classe")))
    places = ValeurDans(Tbl("tblClasses"), "Classe", classe, "Places restantes")
    If IsEmpty(places) Then Notifier "Classe inconnue : " & classe: Exit Sub
    If CDbl(places) <= 0 Then
        If Not Confirmer("La classe " & classe & " est pleine. Inscrire quand même ?") Then Exit Sub
    End If
    If DejaInscrit(Trim$(CStr(Champ("INS_Prenom"))), Trim$(CStr(Champ("INS_Nom"))), _
                   CDate(Champ("INS_DateNaissance"))) Then
        If Not Confirmer("Un élève avec ce prénom, ce nom et cette date de naissance existe déjà. Continuer ?") Then Exit Sub
    End If
    dateIns = Champ("INS_DateInscription")
    If Trim$(CStr(dateIns)) = "" Then dateIns = Date
    If Not IsDate(dateIns) Then Notifier "Date d'inscription invalide.": Exit Sub
    brut = Champ("INS_MontantInscription")
    If Trim$(CStr(brut)) <> "" Then
        montant = LireMontant(brut)
        If montant < 0 Then Notifier "Montant d'inscription invalide.": Exit Sub
    End If

    Debut
    Set lo = Tbl("tblEleves")
    mat = NextMatricule()
    ligne = NouvelleLigne(lo)
    Ecrire lo, ligne, "Matricule", mat
    For Each c In champs
        Ecrire lo, ligne, CStr(c(1)), Champ(c(0))
    Next c
    Ecrire lo, ligne, "Date naissance", CDate(Champ("INS_DateNaissance"))
    Ecrire lo, ligne, "Année", CStr(Nom("AnneeActive"))
    Ecrire lo, ligne, "Statut", "Actif"
    Ecrire lo, ligne, "Date inscription", CDate(dateIns)
    EffacerFormulaire "INS_"
    Fin
    Notifier "Élève inscrit : " & mat
    Exit Sub
Erreur:
    Fin
    Notifier "Erreur : " & Err.Description
End Sub

Public Sub EffacerInscription()
    EffacerFormulaire "INS_"
End Sub
```

Dans `excel/gen/build.py` :
```python
from .sheets import accueil, config, parametres, scolarite

SHEET_BUILDERS = [
    accueil.build,
    scolarite.build_inscription,
    scolarite.build_eleves,
    scolarite.build_classes,
    parametres.build,
]

MODULES = ["modUtil.bas", "modIds.bas", "modEleves.bas"]
```

- [ ] **Step 4 : construire et tester**

Run: `cd excel && .venv/bin/python -m gen.build && .venv/bin/python -m pytest`
Expected: tous les tests passent.

- [ ] **Step 5 : commit**

```bash
git add excel/
git commit -m "feat(excel): classes, élèves et inscription"
```

---

### Task 4: Grille tarifaire, paiements, saisie de paiement

**Files:**
- Create: `excel/gen/sheets/finances.py`, `excel/vba/modFinances.bas`
- Modify: `excel/gen/sheets/scolarite.py` (`EXTRA_CLASS_COLUMNS`), `excel/vba/modIds.bas` (`NextRecu`), `excel/vba/modEleves.bas` (paiement à l'inscription), `excel/gen/build.py`
- Test: `excel/tests/test_paiements.py`, `excel/tests/helpers.py` (ajout `payer`, `libelle`)

**Interfaces:**
- Consumes: Task 1–3 (`tblEleves`, `tblClasses`, `tblTypesFrais`, `L_Eleves`, `L_TypesFrais`, `L_MoisPaiement`).
- Produces:
  - `tblGrille` (Classe, Type de frais, Montant, Périodicité, Obligatoire, Clé = « Classe|Type »).
  - `tblClasses` + colonnes `Mensuel obligatoire`, `Unique obligatoire`.
  - `tblPaiements` (N° reçu, Date, Matricule, Élève, Classe, Type de frais, Mois, Montant, Note, Clé = « Matricule|Type|Mois », Obligatoire, Périodicité, Mois encaissement = 1 (oct) … 12 (sept)).
  - Cellules `SP_Eleve`, `SP_Type`, `SP_Mois`, `SP_Montant`, `SP_Date`, `SP_Note` (saisie), `SP_Matricule`, `SP_Classe`, `SP_MontantGrille`, `SP_DejaPaye` (formules).
  - VBA `modIds.NextRecu() As String` ; `modFinances.Periodicite(type) As String`, `modFinances.AjouterPaiement(mat, type, mois, montant As Double, dt As Date, note) As String` (« » si refusé, message déjà notifié), `EnregistrerPaiement`, `ProposerMontant`, `EffacerPaiement`, `RemplirGrille`.
  - Test helpers `libelle(g, mat)`, `payer(g, mat, type_, mois, montant, date_=None) -> str`.

- [ ] **Step 1 : tests (doivent échouer)**

Ajouter à `excel/tests/helpers.py` :
```python
def libelle(g, mat):
    return next(r["Libellé"] for r in g.rows("tblEleves") if r["Matricule"] == mat)


def payer(g, mat, type_, mois, montant, date_=None, note=None):
    g.fill(dict(SP_Eleve=libelle(g, mat), SP_Type=type_, SP_Mois=mois, SP_Montant=montant,
                SP_Date=date_, SP_Note=note))
    g.run("modFinances.EnregistrerPaiement")
    return g.message()
```

`excel/tests/test_paiements.py` :
```python
import pytest

from helpers import inscrire, payer

MAT = "ELV-2026-0001"


@pytest.fixture
def g1(g):
    inscrire(g)
    g.run("modFinances.RemplirGrille")
    return g


def test_remplir_grille(g):
    g.run("modFinances.RemplirGrille")
    rows = g.rows("tblGrille")
    assert len(rows) == 13 * 5
    sco_ci = next(r for r in rows if r["Clé"] == "CI|Scolarité")
    assert sco_ci["Montant"] == 25000 and sco_ci["Périodicité"] == "Mensuel"
    g.run("modFinances.RemplirGrille")
    assert g.message().startswith("0 ")
    assert len(g.rows("tblGrille")) == 65


def test_mensuel_obligatoire_par_classe(g1):
    ci = next(r for r in g1.rows("tblClasses") if r["Classe"] == "CI")
    assert ci["Mensuel obligatoire"] == 25000
    assert ci["Unique obligatoire"] == 50000


def test_paiement_enregistre(g1):
    msg = payer(g1, MAT, "Scolarité", "Octobre", 25000)
    p = g1.rows("tblPaiements")
    assert len(p) == 1
    assert p[0]["N° reçu"] == "REC-2026-0001"
    assert p[0]["Élève"] == "Awa Diop" and p[0]["Classe"] == "CI"
    assert p[0]["Clé"] == f"{MAT}|Scolarité|Octobre"
    assert "REC-2026-0001" in msg
    assert g1.get("SP_Eleve") is None


def test_doublon_refuse(g1):
    payer(g1, MAT, "Scolarité", "Octobre", 25000)
    msg = payer(g1, MAT, "Scolarité", "Octobre", 25000)
    assert "Déjà payé" in msg and "REC-2026-0001" in msg
    assert len(g1.rows("tblPaiements")) == 1


def test_frais_unique_force_le_mois(g1):
    payer(g1, MAT, "Inscription", "Octobre", 50000)
    assert g1.rows("tblPaiements")[0]["Mois"] == "Unique"
    msg = payer(g1, MAT, "Inscription", "Mars", 50000)
    assert "Déjà payé" in msg


def test_mensuel_sans_mois_refuse(g1):
    msg = payer(g1, MAT, "Scolarité", None, 25000)
    assert "Choisissez un mois" in msg
    assert g1.rows("tblPaiements") == []


def test_montant_texte_avec_espaces(g1):
    payer(g1, MAT, "Scolarité", "Octobre", "25 000")
    assert g1.rows("tblPaiements")[0]["Montant"] == 25000


def test_montant_invalide(g1):
    assert payer(g1, MAT, "Scolarité", "Octobre", "abc") == "Montant invalide."


def test_proposer_montant(g1):
    g1.fill(dict(SP_Eleve=f"{MAT} - Awa Diop", SP_Type="Scolarité"))
    g1.run("modFinances.ProposerMontant")
    assert g1.get("SP_Montant") == 25000


def test_inscription_avec_paiement(g):
    msg = inscrire(g, INS_MontantInscription=50000)
    p = g.rows("tblPaiements")
    assert len(p) == 1 and p[0]["Type de frais"] == "Inscription" and p[0]["Mois"] == "Unique"
    assert "REC-2026-0001" in msg
```
Run: `cd excel && .venv/bin/python -m pytest tests/test_paiements.py`
Expected: FAIL.

- [ ] **Step 2 : feuilles financières**

Dans `excel/gen/sheets/scolarite.py`, remplacer `EXTRA_CLASS_COLUMNS = []` par :
```python
EXTRA_CLASS_COLUMNS = [
    {"h": "Mensuel obligatoire", "fmt": "money", "w": 16,
     "f": '=SUMIFS(tblGrille[Montant],tblGrille[Classe],tblClasses[@[Classe]],'
          'tblGrille[Obligatoire],"Oui",tblGrille[Périodicité],"Mensuel")'},
    {"h": "Unique obligatoire", "fmt": "money", "w": 16,
     "f": '=SUMIFS(tblGrille[Montant],tblGrille[Classe],tblClasses[@[Classe]],'
          'tblGrille[Obligatoire],"Oui",tblGrille[Périodicité],"Unique")'},
]
```

`excel/gen/sheets/finances.py` :
```python
def _lookup_type(table, col):
    return (f'=IFERROR(INDEX(tblTypesFrais[{col}],MATCH({table}[@[Type de frais]],'
            f'tblTypesFrais[Type de frais],0)),"")')


def build_saisie_paiement(book):
    f = book.f
    s = "Saisie paiement"
    ws = book.sheet(s, "Encaisser un paiement")
    ws.set_column(0, 0, 24)
    ws.set_column(1, 1, 40)
    ws.set_column(3, 3, 24)
    ws.set_column(4, 4, 22)
    ws.write(2, 0, "Choisissez l'élève, le frais et le mois, puis « Enregistrer le paiement ». "
                   "Le reçu PDF est créé dans le dossier « Recus ».", f["info"])
    rows = [
        (5, "Élève *", "SP_Eleve", "input", "L_Eleves"),
        (6, "Type de frais *", "SP_Type", "input", "L_TypesFrais"),
        (7, "Mois *", "SP_Mois", "input", "L_MoisPaiement"),
        (8, "Montant *", "SP_Montant", "input_money", None),
        (9, "Date (vide = aujourd'hui)", "SP_Date", "input_date", None),
        (10, "Note", "SP_Note", "input", None),
    ]
    for row, label, name, fmt, lst in rows:
        ws.write(row - 1, 0, label, f["label"])
        ws.write_blank(row - 1, 1, None, f[fmt])
        book.cell_name(name, s, f"B{row}")
        if lst:
            ws.data_validation(row - 1, 1, row - 1, 1, {"validate": "list", "source": "=" + lst})
    ws.write(6, 2, "« Unique » pour les frais non mensuels", f["info"])
    infos = [
        (5, "Classe :", "SP_Classe",
         '=IFERROR(INDEX(tblEleves[Classe],MATCH(SP_Matricule,tblEleves[Matricule],0)),"")', "label"),
        (6, "Montant de la grille :", "SP_MontantGrille",
         '=IFERROR(INDEX(tblGrille[Montant],MATCH(SP_Classe&"|"&SP_Type,tblGrille[Clé],0)),"")', "money"),
        (7, "Déjà payé :", "SP_DejaPaye",
         '=IFERROR(IF(SP_Matricule="","",IF(COUNTIF(tblPaiements[Clé],SP_Matricule&"|"&SP_Type&"|"&'
         'IF(INDEX(tblTypesFrais[Périodicité],MATCH(SP_Type,tblTypesFrais[Type de frais],0))="Unique",'
         '"Unique",SP_Mois))>0,"OUI","Non")),"")', "label"),
        (11, "Matricule :", "SP_Matricule",
         '=IFERROR(LEFT(SP_Eleve,FIND(" - ",SP_Eleve)-1),"")', "info"),
    ]
    for row, label, name, formula, fmt in infos:
        ws.write(row - 1, 3, label, f["info"])
        ws.write_formula(row - 1, 4, formula, f[fmt])
        book.cell_name(name, s, f"E{row}")
    book.button(s, "B12", "Proposer le montant de la grille", "modFinances.ProposerMontant", 200)
    book.button(s, "B14", "Enregistrer le paiement", "modFinances.EnregistrerPaiement", 200)
    book.button(s, "B16", "Effacer", "modFinances.EffacerPaiement", 200)


def build_paiements(book):
    s = "Paiements"
    P = "tblPaiements"
    ws = book.sheet(s, "Paiements")
    ws.write(2, 0, "Journal des paiements de l'année active (saisie via « Saisie paiement »).",
             book.f["info"])
    book.table(s, P, 3, 0, [
        {"h": "N° reçu", "w": 15},
        {"h": "Date", "fmt": "date", "w": 11},
        {"h": "Matricule", "w": 15},
        {"h": "Élève", "w": 24},
        {"h": "Classe", "w": 14},
        {"h": "Type de frais", "w": 14},
        {"h": "Mois", "w": 11},
        {"h": "Montant", "fmt": "money", "w": 14},
        {"h": "Note", "w": 22},
        {"h": "Clé", "w": 10, "f": f'={P}[@[Matricule]]&"|"&{P}[@[Type de frais]]&"|"&{P}[@[Mois]]'},
        {"h": "Obligatoire", "w": 10, "f": _lookup_type(P, "Obligatoire")},
        {"h": "Périodicité", "w": 10, "f": _lookup_type(P, "Périodicité")},
        {"h": "Mois encaissement", "w": 10,
         "f": f'=IF({P}[@[Date]]="","",MOD(MONTH({P}[@[Date]])-10,12)+1)'},
    ])
    ws.freeze_panes(4, 1)


def build_grille(book):
    s = "Grille tarifaire"
    G = "tblGrille"
    ws = book.sheet(s, "Grille tarifaire")
    ws.write(2, 0, "Montant par classe : mensuel pour les frais « Mensuel », unique pour les frais « Unique ».",
             book.f["info"])
    book.table(s, G, 3, 0, [
        {"h": "Classe", "list": "L_Classes", "w": 18},
        {"h": "Type de frais", "list": "L_TypesFrais", "w": 16},
        {"h": "Montant", "fmt": "money", "w": 14},
        {"h": "Périodicité", "w": 12, "f": _lookup_type(G, "Périodicité")},
        {"h": "Obligatoire", "w": 12, "f": _lookup_type(G, "Obligatoire")},
        {"h": "Clé", "w": 22, "f": f'={G}[@[Classe]]&"|"&{G}[@[Type de frais]]'},
    ])
    book.button(s, "H1", "Remplir avec les montants par défaut", "modFinances.RemplirGrille", 230)
```

- [ ] **Step 3 : VBA finances**

Ajouter à la fin de `excel/vba/modIds.bas` :
```vba
Public Function NextRecu() As String
    Dim pfx As String
    pfx = CStr(Nom("Prefixe_Recu")) & "-" & CStr(Nom("AnneeDebut")) & "-"
    NextRecu = pfx & Format$(MaxSuffixe(Tbl("tblPaiements"), "N° reçu", pfx) + 1, "0000")
End Function
```

`excel/vba/modFinances.bas` :
```vba
Option Explicit
' Grille tarifaire et paiements.

Public Function Periodicite(ByVal typeFrais As String) As String
    Periodicite = CStr(ValeurDans(Tbl("tblTypesFrais"), "Type de frais", typeFrais, "Périodicité"))
End Function

' Enregistre un paiement. Renvoie le n° de reçu, ou "" si refusé (le motif est déjà notifié).
Public Function AjouterPaiement(ByVal mat As String, ByVal typeFrais As String, ByVal mois As String, _
        ByVal montant As Double, ByVal dt As Date, ByVal note As String) As String
    Dim lo As ListObject, le As ListObject, iEl As Long, iExist As Long, ligne As Long
    Dim cle As String, num As String, per As String
    per = Periodicite(typeFrais)
    If per = "" Then Notifier "Type de frais inconnu : " & typeFrais: Exit Function
    If per = "Unique" Then
        mois = "Unique"
    ElseIf IndexMois(mois) = 0 Then
        Notifier "Choisissez un mois d'octobre à juillet pour « " & typeFrais & " ».": Exit Function
    End If
    If montant <= 0 Then Notifier "Montant invalide.": Exit Function
    Set le = Tbl("tblEleves")
    iEl = TrouverLigne(le, "Matricule", mat)
    If iEl = 0 Then Notifier "Élève introuvable : " & mat: Exit Function
    Set lo = Tbl("tblPaiements")
    cle = mat & "|" & typeFrais & "|" & mois
    iExist = TrouverLigne(lo, "Clé", cle)
    If iExist > 0 Then
        Notifier "Déjà payé : " & typeFrais & " " & mois & " (reçu " & Valeur(lo, iExist, "N° reçu") & ")."
        Exit Function
    End If
    num = NextRecu()
    ligne = NouvelleLigne(lo)
    Ecrire lo, ligne, "N° reçu", num
    Ecrire lo, ligne, "Date", dt
    Ecrire lo, ligne, "Matricule", mat
    Ecrire lo, ligne, "Élève", Valeur(le, iEl, "Prénom") & " " & Valeur(le, iEl, "Nom")
    Ecrire lo, ligne, "Classe", Valeur(le, iEl, "Classe")
    Ecrire lo, ligne, "Type de frais", typeFrais
    Ecrire lo, ligne, "Mois", mois
    Ecrire lo, ligne, "Montant", montant
    Ecrire lo, ligne, "Note", note
    AjouterPaiement = num
End Function

Public Sub EnregistrerPaiement()
    Dim mat As String, typ As String, mois As String, mt As Double, dt As Variant, num As String
    On Error GoTo Erreur
    mat = CStr(Champ("SP_Matricule"))
    typ = Trim$(CStr(Champ("SP_Type")))
    mois = Trim$(CStr(Champ("SP_Mois")))
    If mat = "" Then Notifier "Choisissez un élève.": Exit Sub
    If typ = "" Then Notifier "Choisissez un type de frais.": Exit Sub
    mt = LireMontant(Champ("SP_Montant"))
    If mt <= 0 Then Notifier "Montant invalide.": Exit Sub
    dt = Champ("SP_Date")
    If Trim$(CStr(dt)) = "" Then dt = Date
    If Not IsDate(dt) Then Notifier "Date invalide.": Exit Sub
    Debut
    num = AjouterPaiement(mat, typ, mois, mt, CDate(dt), CStr(Champ("SP_Note")))
    Fin
    If num = "" Then Exit Sub
    EffacerFormulaire "SP_"
    Notifier "Paiement enregistré : reçu " & num
    Exit Sub
Erreur:
    Fin
    Notifier "Erreur : " & Err.Description
End Sub

Public Sub ProposerMontant()
    Dim v As Variant
    v = Champ("SP_MontantGrille")
    If Trim$(CStr(v)) = "" Then
        Notifier "Aucun montant dans la grille pour cette classe et ce type de frais."
    Else
        DefinirChamp "SP_Montant", v
    End If
End Sub

Public Sub EffacerPaiement()
    EffacerFormulaire "SP_"
End Sub

Public Sub RemplirGrille()
    Dim cl As ListObject, tf As ListObject, gr As ListObject, i As Long, j As Long, n As Long, ligne As Long
    Dim classe As String, typ As String
    On Error GoTo Erreur
    Set cl = Tbl("tblClasses"): Set tf = Tbl("tblTypesFrais"): Set gr = Tbl("tblGrille")
    Debut
    For i = 1 To NombreLignes(cl)
        classe = CStr(Valeur(cl, i, "Classe"))
        For j = 1 To NombreLignes(tf)
            typ = CStr(Valeur(tf, j, "Type de frais"))
            If TrouverLigne(gr, "Clé", classe & "|" & typ) = 0 Then
                ligne = NouvelleLigne(gr)
                Ecrire gr, ligne, "Classe", classe
                Ecrire gr, ligne, "Type de frais", typ
                Ecrire gr, ligne, "Montant", Valeur(tf, j, "Montant par défaut")
                n = n + 1
            End If
        Next j
    Next i
    Fin
    Notifier n & " ligne(s) ajoutée(s) à la grille."
    Exit Sub
Erreur:
    Fin
    Notifier "Erreur : " & Err.Description
End Sub
```
(`Debut` passe le calcul en manuel : la colonne Clé des lignes ajoutées n'est pas recalculée pendant la boucle, ce qui est sans risque car chaque couple classe × type n'est traité qu'une fois.)

Dans `excel/vba/modEleves.bas`, procédure `Inscrire` : déclarer `Dim num As String` avec les autres variables, puis remplacer les lignes
```vba
    EffacerFormulaire "INS_"
    Fin
    Notifier "Élève inscrit : " & mat
```
par :
```vba
    If montant > 0 Then
        Application.Calculate
        num = AjouterPaiement(mat, "Inscription", "Unique", montant, CDate(dateIns), "Inscription")
    End If
    EffacerFormulaire "INS_"
    Fin
    If num <> "" Then
        Notifier "Élève inscrit : " & mat & vbLf & "Paiement enregistré : reçu " & num
    Else
        Notifier "Élève inscrit : " & mat
    End If
```

Dans `excel/gen/build.py` :
```python
from .sheets import accueil, config, finances, parametres, scolarite

SHEET_BUILDERS = [
    accueil.build,
    scolarite.build_inscription,
    scolarite.build_eleves,
    scolarite.build_classes,
    finances.build_saisie_paiement,
    finances.build_paiements,
    finances.build_grille,
    parametres.build,
]

MODULES = ["modUtil.bas", "modIds.bas", "modEleves.bas", "modFinances.bas"]
```

- [ ] **Step 4 : construire et tester**

Run: `cd excel && .venv/bin/python -m gen.build && .venv/bin/python -m pytest`
Expected: tous les tests passent.

- [ ] **Step 5 : commit**

```bash
git add excel/
git commit -m "feat(excel): grille tarifaire et paiements"
```

---

### Task 5: Suivi des paiements et impayés

**Files:**
- Create: `excel/gen/sheets/suivi.py`
- Modify: `excel/gen/build.py`
- Test: `excel/tests/test_suivi_impayes.py`

**Interfaces:**
- Consumes: `tblEleves[Clé classe]`, `tblEleves[Rang actif]`, `tblPaiements`, `tblClasses[Mensuel obligatoire]`, `tblClasses[Unique obligatoire]`, `MoisEcoules`.
- Produces:
  - Feuille « Suivi » : `SUI_Classe`, `SUI_Type` ; grille ligne d'en-tête 5, données lignes 6–65 (A n°, B matricule, C élève, D…M Octobre…Juillet, N total payé).
  - Feuille « Impayés » : en-tête ligne 6, données lignes 7–1006, colonnes A n°, B matricule, C élève, D classe, E téléphone, F dû, G payé, H reste, I mois de retard, J sélection ; noms `IMP_TotalReste`, `IMP_NbRetard`. (Constantes réutilisées par modImpression en Task 9.)

- [ ] **Step 1 : tests (doivent échouer)**

`excel/tests/test_suivi_impayes.py` :
```python
from datetime import datetime

import pytest

from helpers import inscrire, payer

A, B, C = "ELV-2026-0001", "ELV-2026-0002", "ELV-2026-0003"


@pytest.fixture
def g3(g):
    g.run("modFinances.RemplirGrille")
    inscrire(g, INS_Prenom="Awa")
    inscrire(g, INS_Prenom="Binta")
    inscrire(g, INS_Prenom="Cheikh", INS_Classe="CP")
    return g


def suivi(g, row):
    return g.book.sheets["Suivi"].range(f"A{row}:N{row}").value


def impayes(g):
    vals = g.book.sheets["Impayés"].range("B7:J20").value
    return {r[0]: r for r in vals if r[0]}


def test_suivi_liste_les_eleves_de_la_classe(g3):
    g3.set("SUI_Classe", "CI")
    assert suivi(g3, 6)[1] == A
    assert suivi(g3, 7)[1] == B
    assert suivi(g3, 8)[1] in (None, "")


def test_suivi_mois_paye(g3):
    payer(g3, A, "Scolarité", "Octobre", 25000)
    g3.fill({"SUI_Classe": "CI", "SUI_Type": "Scolarité"})
    ligne = suivi(g3, 6)
    assert ligne[2] == "Awa Diop"
    assert ligne[3] == "Payé" and ligne[4] == "—"
    assert ligne[13] == 25000


def test_impayes_du_paye_reste(g3):
    payer(g3, A, "Scolarité", "Octobre", 25000)
    payer(g3, A, "Inscription", "Unique", 50000)
    imp = impayes(g3)
    # 15/01/2027 : 4 mois écoulés -> 4 x 25 000 + inscription 50 000
    assert imp[A][4] == 150000      # F dû
    assert imp[A][5] == 75000       # G payé
    assert imp[A][6] == 75000       # H reste
    assert imp[A][7] == 3           # I mois de retard
    assert imp[B][6] == 150000


def test_frais_facultatifs_ignores(g3):
    payer(g3, A, "Tenue", "Unique", 15000)
    assert impayes(g3)[A][5] == 0


def test_inactif_exclu(g3):
    g3.cell("tblEleves", 3, "Statut").value = "Transféré"
    assert C not in impayes(g3)
    g3.set("SUI_Classe", "CP")
    assert suivi(g3, 6)[1] in (None, "")


def test_avant_la_rentree_rien_du(g3):
    g3.set("DateReference", datetime(2026, 9, 15))
    assert impayes(g3)[A][4] == 0
    assert g3.get("IMP_TotalReste") == 0


def test_totaux(g3):
    assert g3.get("IMP_TotalReste") == 3 * 150000
    assert g3.get("IMP_NbRetard") == 3
```
Run: `cd excel && .venv/bin/python -m pytest tests/test_suivi_impayes.py`
Expected: FAIL.

- [ ] **Step 2 : feuilles Suivi et Impayés**

`excel/gen/sheets/suivi.py` :
```python
from xlsxwriter.utility import xl_col_to_name

from .config import MOIS10

SUIVI_FIRST, SUIVI_LAST = 6, 65          # lignes Excel
IMP_FIRST, IMP_LAST = 7, 1006


def _nom_eleve(cell):
    return (f'IF({cell}="","",INDEX(tblEleves[Prénom],MATCH({cell},tblEleves[Matricule],0))&" "&'
            f'INDEX(tblEleves[Nom],MATCH({cell},tblEleves[Matricule],0)))')


def build_suivi(book):
    f = book.f
    s = "Suivi"
    ws = book.sheet(s, "Suivi des paiements")
    ws.write(2, 0, "Classe :", f["label"])
    ws.write_blank(2, 1, None, f["input"])
    ws.data_validation(2, 1, 2, 1, {"validate": "list", "source": "=L_Classes"})
    book.cell_name("SUI_Classe", s, "B3")
    ws.write(2, 3, "Type de frais :", f["label"])
    ws.write(2, 4, "Scolarité", f["input"])
    ws.data_validation(2, 4, 2, 4, {"validate": "list", "source": "=L_TypesFrais"})
    book.cell_name("SUI_Type", s, "E3")
    ws.write(3, 0, "Vert = payé, rouge = mois écoulé non payé. Frais uniques : voir « Total payé ».", f["info"])
    headers = ["N°", "Matricule", "Élève"] + MOIS10 + ["Total payé"]
    for j, h in enumerate(headers):
        ws.write(4, j, h, f["hdr"])
    ws.set_column(0, 0, 5)
    ws.set_column(1, 1, 15)
    ws.set_column(2, 2, 24)
    ws.set_column(3, 12, 10)
    ws.set_column(13, 13, 14)
    for r in range(SUIVI_FIRST, SUIVI_LAST + 1):
        i = r - 1
        n = r - SUIVI_FIRST + 1
        ws.write(i, 0, n)
        ws.write_formula(i, 1, f'=IFERROR(INDEX(tblEleves[Matricule],MATCH(SUI_Classe&"|"&$A{r},'
                               f'tblEleves[Clé classe],0)),"")')
        ws.write_formula(i, 2, "=" + _nom_eleve(f"$B{r}"))
        for j in range(3, 13):
            col = xl_col_to_name(j)
            ws.write_formula(i, j, f'=IF($B{r}="","",IF(COUNTIF(tblPaiements[Clé],'
                                   f'$B{r}&"|"&SUI_Type&"|"&{col}$5)>0,"Payé","—"))')
        ws.write_formula(i, 13, f'=IF($B{r}="","",SUMIFS(tblPaiements[Montant],tblPaiements[Matricule],'
                                f'$B{r},tblPaiements[Type de frais],SUI_Type))', f["money"])
    rng = f"D{SUIVI_FIRST}:M{SUIVI_LAST}"
    ws.conditional_format(rng, {"type": "formula", "criteria": f'=D{SUIVI_FIRST}="Payé"', "format": f["green"]})
    ws.conditional_format(rng, {"type": "formula",
                                "criteria": f'=AND(D{SUIVI_FIRST}="—",COLUMN(D{SUIVI_FIRST})-3<=MoisEcoules)',
                                "format": f["red"]})
    ws.conditional_format(rng, {"type": "formula", "criteria": f'=D{SUIVI_FIRST}="—"', "format": f["grey"]})
    ws.freeze_panes(5, 3)


def build_impayes(book):
    f = book.f
    s = "Impayés"
    ws = book.sheet(s, "Impayés")
    ws.write(2, 0, "Total restant dû :", f["label"])
    ws.write_formula(2, 2, f"=SUM(H{IMP_FIRST}:H{IMP_LAST})", f["money_b"])
    book.cell_name("IMP_TotalReste", s, "C3")
    ws.write(2, 4, "Élèves en retard :", f["label"])
    ws.write_formula(2, 6, f'=COUNTIF(H{IMP_FIRST}:H{IMP_LAST},">0")', f["label"])
    book.cell_name("IMP_NbRetard", s, "G3")
    ws.write(3, 0, "Dû = frais obligatoires jusqu'au mois en cours. Mettez « x » dans « Sélection » "
                   "pour imprimer des relances ciblées.", f["info"])
    headers = ["N°", "Matricule", "Élève", "Classe", "Téléphone", "Dû", "Payé", "Reste",
               "Mois de retard", "Sélection"]
    for j, h in enumerate(headers):
        ws.write(5, j, h, f["hdr"])
    widths = [5, 15, 24, 14, 17, 13, 13, 13, 9, 10]
    for j, w in enumerate(widths):
        ws.set_column(j, j, w)
    mensuel = 'INDEX(tblClasses[Mensuel obligatoire],MATCH($D{r},tblClasses[Classe],0))'
    unique = 'INDEX(tblClasses[Unique obligatoire],MATCH($D{r},tblClasses[Classe],0))'
    for r in range(IMP_FIRST, IMP_LAST + 1):
        i = r - 1
        ws.write(i, 0, r - IMP_FIRST + 1)
        ws.write_formula(i, 1, f'=IFERROR(INDEX(tblEleves[Matricule],MATCH($A{r},tblEleves[Rang actif],0)),"")')
        ws.write_formula(i, 2, "=" + _nom_eleve(f"$B{r}"))
        ws.write_formula(i, 3, f'=IF($B{r}="","",INDEX(tblEleves[Classe],MATCH($B{r},tblEleves[Matricule],0)))')
        ws.write_formula(i, 4, f'=IF($B{r}="","",INDEX(tblEleves[Téléphone],MATCH($B{r},tblEleves[Matricule],0))&"")')
        ws.write_formula(i, 5, f'=IF($B{r}="","",IFERROR({mensuel.format(r=r)}*MoisEcoules+'
                               f'IF(MoisEcoules>=1,{unique.format(r=r)},0),0))', f["money"])
        ws.write_formula(i, 6, f'=IF($B{r}="","",SUMIFS(tblPaiements[Montant],tblPaiements[Matricule],$B{r},'
                               f'tblPaiements[Obligatoire],"Oui"))', f["money"])
        ws.write_formula(i, 7, f'=IF($B{r}="","",MAX(0,F{r}-G{r}))', f["money"])
        ws.write_formula(i, 8, f'=IF($B{r}="","",IFERROR(MAX(0,MoisEcoules-INT(SUMIFS(tblPaiements[Montant],'
                               f'tblPaiements[Matricule],$B{r},tblPaiements[Obligatoire],"Oui",'
                               f'tblPaiements[Périodicité],"Mensuel")/{mensuel.format(r=r)})),0))')
    ws.conditional_format(f"H{IMP_FIRST}:H{IMP_LAST}", {"type": "cell", "criteria": ">", "value": 0,
                                                        "format": f["red"]})
    ws.autofilter(5, 0, IMP_LAST - 1, 9)
    ws.freeze_panes(6, 3)
```

Dans `excel/gen/build.py` :
```python
from .sheets import accueil, config, finances, parametres, scolarite, suivi

SHEET_BUILDERS = [
    accueil.build,
    scolarite.build_inscription,
    scolarite.build_eleves,
    scolarite.build_classes,
    finances.build_saisie_paiement,
    finances.build_paiements,
    suivi.build_suivi,
    suivi.build_impayes,
    finances.build_grille,
    parametres.build,
]
```

- [ ] **Step 3 : construire et tester**

Run: `cd excel && .venv/bin/python -m gen.build && .venv/bin/python -m pytest`
Expected: tous les tests passent.

- [ ] **Step 4 : commit**

```bash
git add excel/
git commit -m "feat(excel): suivi des paiements et impayés"
```

---

### Task 6: Paie (employés, bulletins, historique)

**Files:**
- Create: `excel/gen/sheets/paie.py`, `excel/vba/modPaie.bas`
- Modify: `excel/vba/modIds.bas` (`NextEmploye`), `excel/gen/build.py`
- Test: `excel/tests/test_paie.py`, `excel/tests/helpers.py` (ajout `employe`)

**Interfaces:**
- Consumes: modUtil, `Prefixe_Employe`, `L_Mois12`.
- Produces:
  - `tblEmployes` (Matricule, Prénom, Nom, Poste, Type, Salaire de base, Téléphone, Date embauche, Statut, Libellé).
  - `tblBulletins` (Mois, Matricule, Employé, Salaire de base, Primes, Retenues, Net, Payé, Date paiement, Clé = « Mois|Matricule ») ; cellule `BUL_Mois`.
  - Feuille « Historique paie » (lignes 5–16 = Octobre…Septembre, total ligne 17).
  - VBA `modIds.NextEmploye() As String` ; `modPaie.NouvelEmploye`, `GenererMoisChoisi`, `GenererMois(mois) As Long`, `MarquerPaye(ligne As Long)`, `MarquerPayeSelection`.
  - Test helper `employe(g, prenom, nom, salaire, statut="Actif", poste="Enseignant") -> int` (index de ligne).

- [ ] **Step 1 : tests (doivent échouer)**

Ajouter à `excel/tests/helpers.py` :
```python
def employe(g, prenom, nom, salaire, statut="Actif", poste="Enseignant"):
    g.run("modPaie.NouvelEmploye")
    idx = len(g.rows("tblEmployes"))
    g.set_row("tblEmployes", idx, {"Prénom": prenom, "Nom": nom, "Salaire de base": salaire,
                                   "Statut": statut, "Poste": poste, "Type": "Enseignant"})
    return idx
```

`excel/tests/test_paie.py` :
```python
from datetime import date

import pytest

from helpers import employe


@pytest.fixture
def gp(g):
    employe(g, "Fatou", "Sow", 150000)
    employe(g, "Ibou", "Fall", 120000)
    employe(g, "Ndiaga", "Ba", 90000, statut="Inactif")
    return g


def test_matricules_employes(gp):
    assert [r["Matricule"] for r in gp.rows("tblEmployes")] == ["EMP-001", "EMP-002", "EMP-003"]


def test_generer_mois(gp):
    gp.set("BUL_Mois", "Octobre")
    gp.run("modPaie.GenererMoisChoisi")
    b = gp.rows("tblBulletins")
    assert [(r["Mois"], r["Matricule"], r["Salaire de base"], r["Payé"]) for r in b] == [
        ("Octobre", "EMP-001", 150000, "Non"), ("Octobre", "EMP-002", 120000, "Non")]
    assert b[0]["Employé"] == "Fatou Sow"
    gp.run("modPaie.GenererMoisChoisi")
    assert gp.message().startswith("0 ")
    assert len(gp.rows("tblBulletins")) == 2


def test_net(gp):
    gp.run("modPaie.GenererMois", "Octobre")
    gp.set_row("tblBulletins", 1, {"Primes": 10000, "Retenues": 5000})
    assert gp.rows("tblBulletins")[0]["Net"] == 155000


def test_marquer_paye(gp):
    gp.run("modPaie.GenererMois", "Octobre")
    gp.run("modPaie.MarquerPaye", 1)
    r = gp.rows("tblBulletins")[0]
    assert r["Payé"] == "Oui"
    assert r["Date paiement"].date() == date.today()


def test_historique(gp):
    gp.run("modPaie.GenererMois", "Octobre")
    gp.run("modPaie.MarquerPaye", 1)
    oct_ = gp.book.sheets["Historique paie"].range("A5:G5").value
    assert oct_ == ["Octobre", 2, 270000, 0, 0, 270000, 150000]


def test_mois_invalide(gp):
    gp.set("BUL_Mois", None)
    gp.run("modPaie.GenererMoisChoisi")
    assert "Choisissez un mois" in gp.message()
```
Run: `cd excel && .venv/bin/python -m pytest tests/test_paie.py`
Expected: FAIL.

- [ ] **Step 2 : feuilles de paie**

`excel/gen/sheets/paie.py` :
```python
from .config import MOIS12

B = "tblBulletins"


def build_employes(book):
    s = "Employés"
    E = "tblEmployes"
    ws = book.sheet(s, "Employés")
    ws.write(2, 0, "« Nouvel employé » crée une ligne avec son matricule ; complétez ensuite la ligne.",
             book.f["info"])
    book.table(s, E, 3, 0, [
        {"h": "Matricule", "w": 11},
        {"h": "Prénom", "w": 16},
        {"h": "Nom", "w": 16},
        {"h": "Poste", "w": 18},
        {"h": "Type", "list": "L_TypeEmp", "w": 14},
        {"h": "Salaire de base", "fmt": "money", "w": 16},
        {"h": "Téléphone", "fmt": "text", "w": 17},
        {"h": "Date embauche", "fmt": "date", "w": 13},
        {"h": "Statut", "list": "L_StatutEmp", "w": 9},
        {"h": "Libellé", "w": 28,
         "f": f'=IF({E}[@[Matricule]]="","",{E}[@[Matricule]]&" - "&{E}[@[Prénom]]&" "&{E}[@[Nom]])'},
    ])
    book.button(s, "F1", "Nouvel employé", "modPaie.NouvelEmploye", 150)


def build_bulletins(book):
    f = book.f
    s = "Bulletins"
    ws = book.sheet(s, "Bulletins de paie")
    ws.write(2, 0, "Mois :", f["label"])
    ws.write(2, 1, "Octobre", f["input"])
    ws.data_validation(2, 1, 2, 1, {"validate": "list", "source": "=L_Mois12"})
    book.cell_name("BUL_Mois", s, "B3")
    ws.write(4, 0, "Modifiez Primes et Retenues directement dans le tableau ; le Net se recalcule.", f["info"])
    book.table(s, B, 5, 0, [
        {"h": "Mois", "list": "L_Mois12", "w": 11},
        {"h": "Matricule", "w": 11},
        {"h": "Employé", "w": 24},
        {"h": "Salaire de base", "fmt": "money", "w": 16},
        {"h": "Primes", "fmt": "money", "w": 14},
        {"h": "Retenues", "fmt": "money", "w": 14},
        {"h": "Net", "fmt": "money", "w": 16,
         "f": f"={B}[@[Salaire de base]]+{B}[@[Primes]]-{B}[@[Retenues]]"},
        {"h": "Payé", "list": "L_OuiNon", "w": 7},
        {"h": "Date paiement", "fmt": "date", "w": 13},
        {"h": "Clé", "w": 18, "f": f'={B}[@[Mois]]&"|"&{B}[@[Matricule]]'},
    ])
    book.button(s, "D3", "Générer les bulletins du mois", "modPaie.GenererMoisChoisi", 200)
    book.button(s, "G3", "Marquer payé (lignes sélectionnées)", "modPaie.MarquerPayeSelection", 230)


def build_historique(book):
    f = book.f
    s = "Historique paie"
    ws = book.sheet(s, "Historique de la paie")
    headers = ["Mois", "Employés", "Salaires de base", "Primes", "Retenues", "Net", "Net payé"]
    for j, h in enumerate(headers):
        ws.write(3, j, h, f["hdr"])
        ws.set_column(j, j, 16)
    for k, m in enumerate(MOIS12):
        r = 5 + k
        i = r - 1
        ws.write(i, 0, m, f["cell"])
        ws.write_formula(i, 1, f"=COUNTIFS({B}[Mois],$A{r})", f["cell"])
        ws.write_formula(i, 2, f"=SUMIFS({B}[Salaire de base],{B}[Mois],$A{r})", f["cell_money"])
        ws.write_formula(i, 3, f"=SUMIFS({B}[Primes],{B}[Mois],$A{r})", f["cell_money"])
        ws.write_formula(i, 4, f"=SUMIFS({B}[Retenues],{B}[Mois],$A{r})", f["cell_money"])
        ws.write_formula(i, 5, f"=SUMIFS({B}[Net],{B}[Mois],$A{r})", f["cell_money"])
        ws.write_formula(i, 6, f'=SUMIFS({B}[Net],{B}[Mois],$A{r},{B}[Payé],"Oui")', f["cell_money"])
    ws.write(16, 0, "Total", f["hdr"])
    for j, col in enumerate("CDEFG", start=2):
        ws.write_formula(16, j, f"=SUM({col}5:{col}16)", f["cell_money_b"])
```

- [ ] **Step 3 : VBA paie**

Ajouter à la fin de `excel/vba/modIds.bas` :
```vba
Public Function NextEmploye() As String
    Dim pfx As String
    pfx = CStr(Nom("Prefixe_Employe")) & "-"
    NextEmploye = pfx & Format$(MaxSuffixe(Tbl("tblEmployes"), "Matricule", pfx) + 1, "000")
End Function
```

`excel/vba/modPaie.bas` :
```vba
Option Explicit
' Employés et bulletins de paie.

Public Sub NouvelEmploye()
    Dim lo As ListObject, i As Long, mat As String
    On Error GoTo Erreur
    Set lo = Tbl("tblEmployes")
    mat = NextEmploye()
    i = NouvelleLigne(lo)
    Ecrire lo, i, "Matricule", mat
    Ecrire lo, i, "Statut", "Actif"
    If Not ModeTest() Then
        lo.Parent.Activate
        lo.DataBodyRange.Cells(i, Col(lo, "Prénom")).Select
    End If
    Notifier "Employé " & mat & " créé : complétez la ligne (prénom, nom, poste, salaire)."
    Exit Sub
Erreur:
    Notifier "Erreur : " & Err.Description
End Sub

Public Sub GenererMoisChoisi()
    GenererMois CStr(Champ("BUL_Mois"))
End Sub

' Crée un bulletin par employé actif sans bulletin pour ce mois. Renvoie le nombre créé.
Public Function GenererMois(ByVal mois As String) As Long
    Dim em As ListObject, bu As ListObject, i As Long, ligne As Long, n As Long, mat As String
    On Error GoTo Erreur
    If IndexMois12(mois) = 0 Then Notifier "Choisissez un mois (octobre à septembre).": Exit Function
    mois = MoisNom12(IndexMois12(mois))
    Set em = Tbl("tblEmployes"): Set bu = Tbl("tblBulletins")
    Debut
    For i = 1 To NombreLignes(em)
        mat = Trim$(CStr(Valeur(em, i, "Matricule")))
        If mat <> "" And Valeur(em, i, "Statut") = "Actif" Then
            If TrouverLigne(bu, "Clé", mois & "|" & mat) = 0 Then
                ligne = NouvelleLigne(bu)
                Ecrire bu, ligne, "Mois", mois
                Ecrire bu, ligne, "Matricule", mat
                Ecrire bu, ligne, "Employé", Valeur(em, i, "Prénom") & " " & Valeur(em, i, "Nom")
                Ecrire bu, ligne, "Salaire de base", Val(Valeur(em, i, "Salaire de base"))
                Ecrire bu, ligne, "Primes", 0
                Ecrire bu, ligne, "Retenues", 0
                Ecrire bu, ligne, "Payé", "Non"
                n = n + 1
            End If
        End If
    Next i
    Fin
    Notifier n & " bulletin(s) créé(s) pour " & mois & "."
    GenererMois = n
    Exit Function
Erreur:
    Fin
    Notifier "Erreur : " & Err.Description
End Function

Public Sub MarquerPaye(ByVal ligne As Long)
    Dim bu As ListObject
    Set bu = Tbl("tblBulletins")
    Ecrire bu, ligne, "Payé", "Oui"
    Ecrire bu, ligne, "Date paiement", Date
End Sub

Public Sub MarquerPayeSelection()
    Dim bu As ListObject, c As Range, zone As Range, n As Long, i As Long, faites As String
    On Error GoTo Erreur
    Set bu = Tbl("tblBulletins")
    If NombreLignes(bu) = 0 Then Notifier "Aucun bulletin.": Exit Sub
    Set zone = Intersect(Selection, bu.DataBodyRange)
    If zone Is Nothing Then Notifier "Sélectionnez des lignes du tableau des bulletins.": Exit Sub
    For Each c In zone.Cells
        i = c.Row - bu.HeaderRowRange.Row
        If InStr(faites, "|" & i & "|") = 0 Then
            MarquerPaye i
            faites = faites & "|" & i & "|"
            n = n + 1
        End If
    Next c
    Notifier n & " bulletin(s) marqué(s) payé(s)."
    Exit Sub
Erreur:
    Notifier "Erreur : " & Err.Description
End Sub
```

Dans `excel/gen/build.py` :
```python
from .sheets import accueil, config, finances, paie, parametres, scolarite, suivi

SHEET_BUILDERS = [
    accueil.build,
    scolarite.build_inscription,
    scolarite.build_eleves,
    scolarite.build_classes,
    finances.build_saisie_paiement,
    finances.build_paiements,
    suivi.build_suivi,
    suivi.build_impayes,
    finances.build_grille,
    paie.build_employes,
    paie.build_bulletins,
    paie.build_historique,
    parametres.build,
]

MODULES = ["modUtil.bas", "modIds.bas", "modEleves.bas", "modFinances.bas", "modPaie.bas"]
```

- [ ] **Step 4 : construire et tester**

Run: `cd excel && .venv/bin/python -m gen.build && .venv/bin/python -m pytest`
Expected: tous les tests passent.

- [ ] **Step 5 : commit**

```bash
git add excel/
git commit -m "feat(excel): paie (employés, bulletins, historique)"
```

---
### Task 7: Dépenses, recettes et bilan

**Files:**
- Create: `excel/gen/sheets/compta.py`
- Modify: `excel/gen/build.py`
- Test: `excel/tests/test_bilan.py`

**Interfaces:**
- Consumes: `tblPaiements[Mois encaissement]`, `tblBulletins` (Task 6), `L_CatDepenses`, `L_CatRecettes`.
- Produces: `tblDepenses` et `tblRecettes` (Date, Catégorie, Libellé, Montant, Note, Mois scolaire = 1 (oct) … 12 (sept)) ; feuille « Bilan » (lignes 5–16 = Octobre…Septembre, colonnes A mois, B paiements, C recettes, D dépenses, E salaires payés, F solde, H index caché ; total ligne 17) ; noms `BIL_Paiements`, `BIL_Recettes`, `BIL_Depenses`, `BIL_Salaires`, `BIL_Solde`.

- [ ] **Step 1 : tests (doivent échouer)**

`excel/tests/test_bilan.py` :
```python
from datetime import datetime

import pytest

from helpers import employe, inscrire, payer

MAT = "ELV-2026-0001"


@pytest.fixture
def gb(g):
    inscrire(g)
    payer(g, MAT, "Scolarité", "Octobre", 25000, datetime(2026, 10, 5))
    g.add_row("tblRecettes", {"Date": datetime(2026, 11, 2), "Catégorie": "Dons",
                              "Libellé": "Don APE", "Montant": 10000})
    g.add_row("tblDepenses", {"Date": datetime(2026, 10, 20), "Catégorie": "Entretien",
                              "Libellé": "Peinture", "Montant": 8000})
    employe(g, "Fatou", "Sow", 100000)
    g.run("modPaie.GenererMois", "Octobre")
    g.run("modPaie.MarquerPaye", 1)
    return g


def ligne(g, row):
    return g.book.sheets["Bilan"].range(f"A{row}:F{row}").value


def test_bilan_octobre(gb):
    assert ligne(gb, 5) == ["Octobre", 25000, 0, 8000, 100000, -83000]


def test_bilan_novembre(gb):
    assert ligne(gb, 6) == ["Novembre", 0, 10000, 0, 0, 10000]


def test_totaux(gb):
    assert gb.get("BIL_Paiements") == 25000
    assert gb.get("BIL_Recettes") == 10000
    assert gb.get("BIL_Depenses") == 8000
    assert gb.get("BIL_Salaires") == 100000
    assert gb.get("BIL_Solde") == 25000 + 10000 - 8000 - 100000


def test_salaire_non_paye_exclu(gb):
    gb.set_row("tblBulletins", 1, {"Payé": "Non"})
    assert gb.get("BIL_Salaires") == 0


def test_paiement_en_aout(gb):
    payer(gb, MAT, "Scolarité", "Juillet", 25000, datetime(2027, 8, 3))
    assert ligne(gb, 15)[0] == "Août" and ligne(gb, 15)[1] == 25000
```
Run: `cd excel && .venv/bin/python -m pytest tests/test_bilan.py`
Expected: FAIL.

- [ ] **Step 2 : feuilles Dépenses, Recettes, Bilan**

`excel/gen/sheets/compta.py` :
```python
from .config import MOIS12


def _journal(book, sheet, title, table, cat_list):
    ws = book.sheet(sheet, title)
    ws.write(2, 0, "Saisissez directement dans le tableau (une ligne par opération).", book.f["info"])
    book.table(sheet, table, 3, 0, [
        {"h": "Date", "fmt": "date", "w": 12},
        {"h": "Catégorie", "list": cat_list, "w": 18},
        {"h": "Libellé", "w": 34},
        {"h": "Montant", "fmt": "money", "w": 14},
        {"h": "Note", "w": 26},
        {"h": "Mois scolaire", "w": 8,
         "f": f'=IF({table}[@[Date]]="","",MOD(MONTH({table}[@[Date]])-10,12)+1)'},
    ])


def build_depenses(book):
    _journal(book, "Dépenses", "Dépenses", "tblDepenses", "L_CatDepenses")


def build_recettes(book):
    _journal(book, "Recettes", "Recettes (hors paiements des élèves)", "tblRecettes", "L_CatRecettes")


def build_bilan(book):
    f = book.f
    s = "Bilan"
    ws = book.sheet(s, "Bilan de l'année")
    ws.write(2, 0, "Solde = paiements + recettes − dépenses − salaires payés (par mois d'encaissement).",
             f["info"])
    headers = ["Mois", "Paiements", "Recettes", "Dépenses", "Salaires payés", "Solde"]
    for j, h in enumerate(headers):
        ws.write(3, j, h, f["hdr"])
        ws.set_column(j, j, 16)
    for k, m in enumerate(MOIS12):
        r = 5 + k
        i = r - 1
        ws.write(i, 0, m, f["cell"])
        ws.write(i, 7, k + 1)
        ws.write_formula(i, 1, f"=SUMIFS(tblPaiements[Montant],tblPaiements[Mois encaissement],$H{r})",
                         f["cell_money"])
        ws.write_formula(i, 2, f"=SUMIFS(tblRecettes[Montant],tblRecettes[Mois scolaire],$H{r})",
                         f["cell_money"])
        ws.write_formula(i, 3, f"=SUMIFS(tblDepenses[Montant],tblDepenses[Mois scolaire],$H{r})",
                         f["cell_money"])
        ws.write_formula(i, 4, f'=SUMIFS(tblBulletins[Net],tblBulletins[Mois],$A{r},tblBulletins[Payé],"Oui")',
                         f["cell_money"])
        ws.write_formula(i, 5, f"=B{r}+C{r}-D{r}-E{r}", f["cell_money_b"])
    ws.write(16, 0, "Total", f["hdr"])
    for j, (col, name) in enumerate(zip("BCDEF", ["BIL_Paiements", "BIL_Recettes", "BIL_Depenses",
                                                  "BIL_Salaires", "BIL_Solde"]), start=1):
        ws.write_formula(16, j, f"=SUM({col}5:{col}16)", f["cell_money_b"])
        book.cell_name(name, s, f"{col}17")
    ws.set_column(7, 7, None, None, {"hidden": True})
```

Dans `excel/gen/build.py` :
```python
from .sheets import accueil, compta, config, finances, paie, parametres, scolarite, suivi

SHEET_BUILDERS = [
    accueil.build,
    scolarite.build_inscription,
    scolarite.build_eleves,
    scolarite.build_classes,
    finances.build_saisie_paiement,
    finances.build_paiements,
    suivi.build_suivi,
    suivi.build_impayes,
    finances.build_grille,
    compta.build_depenses,
    compta.build_recettes,
    compta.build_bilan,
    paie.build_employes,
    paie.build_bulletins,
    paie.build_historique,
    parametres.build,
]
```

- [ ] **Step 3 : construire et tester**

Run: `cd excel && .venv/bin/python -m gen.build && .venv/bin/python -m pytest`
Expected: tous les tests passent.

- [ ] **Step 4 : commit**

```bash
git add excel/
git commit -m "feat(excel): dépenses, recettes et bilan"
```

---

### Task 8: Transport

**Files:**
- Create: `excel/gen/sheets/transport.py`, `excel/vba/modTransport.bas`
- Modify: `excel/gen/build.py`
- Test: `excel/tests/test_transport.py`

**Interfaces:**
- Consumes: `tblEleves`, `L_Eleves`, modUtil.
- Produces: `tblVehicules` (Immatriculation, Marque, Modèle, Capacité, Chauffeur, Téléphone chauffeur, Élèves affectés) ; `tblItineraires` (Itinéraire, Véhicule, Description, Élèves) ; `tblArrets` (Itinéraire, Ordre, Arrêt, Heure de passage, Clé = « Itinéraire|Arrêt ») ; `tblAffectations` (Matricule, Élève, Classe, Itinéraire, Arrêt, Véhicule, Doublon) ; cellules `AFF_Eleve`, `AFF_Itineraire`, `AFF_Arret` ; listes `L_Vehicules`, `L_Itineraires`, `L_Arrets` ; VBA `modTransport.Affecter`.

- [ ] **Step 1 : tests (doivent échouer)**

`excel/tests/test_transport.py` :
```python
import pytest

from helpers import inscrire, libelle

A, B, C = "ELV-2026-0001", "ELV-2026-0002", "ELV-2026-0003"


@pytest.fixture
def gt(g):
    for p in ["Awa", "Binta", "Cheikh"]:
        inscrire(g, INS_Prenom=p)
    g.add_row("tblVehicules", {"Immatriculation": "DK-1234-A", "Capacité": 2, "Chauffeur": "Modou"})
    g.add_row("tblItineraires", {"Itinéraire": "Ligne Nord", "Véhicule": "DK-1234-A"})
    g.add_row("tblArrets", {"Itinéraire": "Ligne Nord", "Ordre": 1, "Arrêt": "Liberté 6"})
    g.add_row("tblArrets", {"Itinéraire": "Ligne Nord", "Ordre": 2, "Arrêt": "Grand Yoff"})
    return g


def affecter(g, mat, itin="Ligne Nord", arret="Liberté 6"):
    g.fill({"AFF_Eleve": libelle(g, mat), "AFF_Itineraire": itin, "AFF_Arret": arret})
    g.run("modTransport.Affecter")
    return g.message()


def test_affecter(gt):
    affecter(gt, A)
    r = gt.rows("tblAffectations")[0]
    assert (r["Matricule"], r["Élève"], r["Classe"], r["Arrêt"], r["Véhicule"]) == (
        A, "Awa Diop", "CI", "Liberté 6", "DK-1234-A")
    assert gt.rows("tblVehicules")[0]["Élèves affectés"] == 1
    assert gt.get("AFF_Eleve") is None


def test_doublon_refuse(gt):
    affecter(gt, A)
    msg = affecter(gt, A, arret="Grand Yoff")
    assert "déjà affecté" in msg
    assert len(gt.rows("tblAffectations")) == 1


def test_arret_hors_itineraire(gt):
    msg = affecter(gt, A, arret="Parcelles")
    assert "n'appartient pas" in msg
    assert gt.rows("tblAffectations") == []


def test_vehicule_plein(gt):
    affecter(gt, A)
    affecter(gt, B)
    gt.set("CFG_ReponseTest", "Non")
    msg = affecter(gt, C)
    assert "plein" in msg
    assert len(gt.rows("tblAffectations")) == 2


def test_doublon_saisi_a_la_main_signale(gt):
    affecter(gt, A)
    gt.add_row("tblAffectations", {"Matricule": A, "Itinéraire": "Ligne Nord", "Arrêt": "Grand Yoff"})
    assert [r["Doublon"] for r in gt.rows("tblAffectations")] == ["DOUBLON", "DOUBLON"]
```
Run: `cd excel && .venv/bin/python -m pytest tests/test_transport.py`
Expected: FAIL.

- [ ] **Step 2 : feuilles transport**

`excel/gen/sheets/transport.py` :
```python
A = "tblAffectations"


def build_vehicules(book):
    s = "Véhicules"
    V = "tblVehicules"
    book.sheet(s, "Véhicules")
    book.table(s, V, 3, 0, [
        {"h": "Immatriculation", "w": 16},
        {"h": "Marque", "w": 14},
        {"h": "Modèle", "w": 14},
        {"h": "Capacité", "fmt": "int", "w": 10},
        {"h": "Chauffeur", "w": 20},
        {"h": "Téléphone chauffeur", "fmt": "text", "w": 18},
        {"h": "Élèves affectés", "w": 12, "f": f"=COUNTIFS({A}[Véhicule],{V}[@[Immatriculation]])"},
    ])
    book.name("L_Vehicules", f"={V}[Immatriculation]")


def build_itineraires(book):
    f = book.f
    s = "Itinéraires"
    I, R = "tblItineraires", "tblArrets"
    ws = book.sheet(s, "Itinéraires et arrêts")
    ws.write(2, 0, "Itinéraires", f["h2"])
    book.table(s, I, 3, 0, [
        {"h": "Itinéraire", "w": 18},
        {"h": "Véhicule", "list": "L_Vehicules", "w": 14},
        {"h": "Description", "w": 30},
        {"h": "Élèves", "w": 9, "f": f"=COUNTIFS({A}[Itinéraire],{I}[@[Itinéraire]])"},
    ])
    ws.write(2, 6, "Arrêts", f["h2"])
    book.table(s, R, 3, 6, [
        {"h": "Itinéraire", "list": "L_Itineraires", "w": 18},
        {"h": "Ordre", "fmt": "int", "w": 8},
        {"h": "Arrêt", "w": 20},
        {"h": "Heure de passage", "fmt": "time", "w": 12},
        {"h": "Clé", "w": 24, "f": f'={R}[@[Itinéraire]]&"|"&{R}[@[Arrêt]]'},
    ])
    book.name("L_Itineraires", f"={I}[Itinéraire]")
    book.name("L_Arrets", f"={R}[Arrêt]")


def build_affectations(book):
    f = book.f
    s = "Affectations"
    ws = book.sheet(s, "Affectations transport")
    for row, label, name, lst in [(3, "Élève", "AFF_Eleve", "L_Eleves"),
                                  (4, "Itinéraire", "AFF_Itineraire", "L_Itineraires"),
                                  (5, "Arrêt", "AFF_Arret", "L_Arrets")]:
        ws.write(row - 1, 0, label, f["label"])
        ws.write_blank(row - 1, 1, None, f["input"])
        ws.data_validation(row - 1, 1, row - 1, 1, {"validate": "list", "source": "=" + lst})
        book.cell_name(name, s, f"B{row}")
    book.button(s, "D3", "Affecter l'élève", "modTransport.Affecter", 150)
    ws.write(5, 3, "Pour retirer un élève : supprimez sa ligne du tableau.", f["info"])
    book.table(s, A, 7, 0, [
        {"h": "Matricule", "w": 16},
        {"h": "Élève", "w": 34},
        {"h": "Classe", "w": 14},
        {"h": "Itinéraire", "list": "L_Itineraires", "w": 18},
        {"h": "Arrêt", "w": 18},
        {"h": "Véhicule", "w": 14,
         "f": f'=IFERROR(INDEX(tblItineraires[Véhicule],MATCH({A}[@[Itinéraire]],tblItineraires[Itinéraire],0)),"")'},
        {"h": "Doublon", "w": 10,
         "f": f'=IF({A}[@[Matricule]]="","",IF(COUNTIF({A}[Matricule],{A}[@[Matricule]])>1,"DOUBLON",""))'},
    ])
    ws.conditional_format("G9:G2000", {"type": "cell", "criteria": "==", "value": '"DOUBLON"',
                                       "format": f["red"]})
```

- [ ] **Step 3 : VBA transport**

`excel/vba/modTransport.bas` :
```vba
Option Explicit
' Affectation des élèves aux itinéraires.

Public Sub Affecter()
    Dim mat As String, itin As String, arret As String, veh As String
    Dim le As ListObject, af As ListObject, it As ListObject, ve As ListObject
    Dim iEl As Long, iAff As Long, ligne As Long, cap As Variant, nb As Variant
    On Error GoTo Erreur
    mat = MatriculeDe(CStr(Champ("AFF_Eleve")))
    itin = Trim$(CStr(Champ("AFF_Itineraire")))
    arret = Trim$(CStr(Champ("AFF_Arret")))
    If mat = "" Or itin = "" Or arret = "" Then Notifier "Choisissez l'élève, l'itinéraire et l'arrêt.": Exit Sub
    Set le = Tbl("tblEleves"): Set af = Tbl("tblAffectations")
    Set it = Tbl("tblItineraires"): Set ve = Tbl("tblVehicules")
    iEl = TrouverLigne(le, "Matricule", mat)
    If iEl = 0 Then Notifier "Élève introuvable : " & mat: Exit Sub
    iAff = TrouverLigne(af, "Matricule", mat)
    If iAff > 0 Then
        Notifier "Cet élève est déjà affecté à l'itinéraire « " & Valeur(af, iAff, "Itinéraire") & " »."
        Exit Sub
    End If
    If TrouverLigne(it, "Itinéraire", itin) = 0 Then Notifier "Itinéraire inconnu : " & itin: Exit Sub
    If TrouverLigne(Tbl("tblArrets"), "Clé", itin & "|" & arret) = 0 Then
        Notifier "L'arrêt « " & arret & " » n'appartient pas à l'itinéraire « " & itin & " ».": Exit Sub
    End If
    veh = CStr(ValeurDans(it, "Itinéraire", itin, "Véhicule"))
    If veh <> "" Then
        cap = ValeurDans(ve, "Immatriculation", veh, "Capacité")
        nb = ValeurDans(ve, "Immatriculation", veh, "Élèves affectés")
        If Val(CStr(cap)) > 0 And Val(CStr(nb)) >= Val(CStr(cap)) Then
            If Not Confirmer("Le véhicule " & veh & " est plein (" & nb & "/" & cap & "). Affecter quand même ?") Then Exit Sub
        End If
    End If
    ligne = NouvelleLigne(af)
    Ecrire af, ligne, "Matricule", mat
    Ecrire af, ligne, "Élève", Valeur(le, iEl, "Prénom") & " " & Valeur(le, iEl, "Nom")
    Ecrire af, ligne, "Classe", Valeur(le, iEl, "Classe")
    Ecrire af, ligne, "Itinéraire", itin
    Ecrire af, ligne, "Arrêt", arret
    EffacerFormulaire "AFF_"
    Notifier "Élève affecté : " & mat & " — " & itin & " / " & arret
    Exit Sub
Erreur:
    Notifier "Erreur : " & Err.Description
End Sub
```

Dans `excel/gen/build.py` : importer `transport`, insérer `transport.build_vehicules, transport.build_itineraires, transport.build_affectations` juste avant `parametres.build`, et ajouter `"modTransport.bas"` à la fin de `MODULES`.

- [ ] **Step 4 : construire et tester**

Run: `cd excel && .venv/bin/python -m gen.build && .venv/bin/python -m pytest`
Expected: tous les tests passent.

- [ ] **Step 5 : commit**

```bash
git add excel/
git commit -m "feat(excel): transport (véhicules, itinéraires, affectations)"
```

---

### Task 9: Impression PDF (reçus, relances, fiches de paie)

**Files:**
- Create: `excel/gen/sheets/modeles.py`, `excel/vba/modImpression.bas`
- Modify: `excel/gen/sheets/finances.py` (bouton Paiements), `excel/gen/sheets/suivi.py` (boutons Impayés), `excel/gen/sheets/paie.py` (boutons Bulletins), `excel/vba/modFinances.bas` et `excel/vba/modEleves.bas` (reçu automatique), `excel/gen/build.py`
- Test: `excel/tests/test_impression.py`

**Interfaces:**
- Consumes: `tblPaiements`, `tblEleves`, `tblGrille`, `tblBulletins`, `tblEmployes`, feuille Impayés (lignes 7–1006 ; B matricule, H reste, J sélection), `BUL_Mois`, `MoisEcoules`, `DateCalcul`, `AnneeDebut`.
- Produces: feuilles « Modèle Reçu » (`R_Numero`, `R_Date`, `R_Eleve`, `R_Matricule`, `R_Classe`, `R_Type`, `R_Mois`, `R_Montant`, `R_Note`), « Modèle Relance » (`REL_Date`, `REL_Parent`, `REL_Tel`, `REL_Eleve`, `REL_Matricule`, `REL_Classe`, `REL_Mois`, `REL_Reste`), « Modèle Fiche de paie » (`FP_Mois`, `FP_Matricule`, `FP_Employe`, `FP_Poste`, `FP_Base`, `FP_Primes`, `FP_Retenues`, `FP_Net`, `FP_Paye`).
  VBA `modImpression` : `ImprimerRecu(num) As String` (chemin PDF ou « »), `ReimprimerSelection`, `MoisImpayes(mat) As String`, `ImprimerRelance(mat) As String`, `ImprimerRelancesSelection`, `ImprimerRelancesToutes`, `ImprimerFiche(ligne As Long) As String`, `ImprimerFicheSelection`, `ImprimerFichesMois`, hook `TestMoisImpayes(mat)`.
  Fichiers : `Recus/<n° reçu>.pdf`, `Relances/Relance <matricule> <aaaa-mm-jj>.pdf`, `Paie/Fiche <matricule> <mois> <année>.pdf`, sous `Dossier()`.

- [ ] **Step 1 : tests (doivent échouer)**

`excel/tests/test_impression.py` :
```python
import re

import pytest

from helpers import employe, inscrire, payer

A, B = "ELV-2026-0001", "ELV-2026-0002"


def pages(path):
    return len(re.findall(rb"/Type\s*/Page[^s]", path.read_bytes()))


@pytest.fixture
def gi(g):
    g.run("modFinances.RemplirGrille")
    inscrire(g, INS_Prenom="Awa")
    inscrire(g, INS_Prenom="Binta")
    return g


def test_recu_pdf_cree_au_paiement(gi):
    msg = payer(gi, A, "Scolarité", "Octobre", 25000)
    pdf = gi.dir / "Recus" / "REC-2026-0001.pdf"
    assert pdf.exists() and pages(pdf) == 1
    assert "REC-2026-0001.pdf" in msg


def test_reimprimer_recu(gi):
    payer(gi, A, "Scolarité", "Octobre", 25000)
    pdf = gi.dir / "Recus" / "REC-2026-0001.pdf"
    pdf.unlink()
    gi.run("modImpression.ImprimerRecu", "REC-2026-0001")
    assert pdf.exists()


def test_mois_impayes(gi):
    payer(gi, A, "Scolarité", "Octobre", 25000)
    gi.run("modImpression.TestMoisImpayes", A)
    assert gi.message() == "Novembre, Décembre, Janvier, Inscription"


def test_relances_toutes(gi):
    gi.run("modImpression.ImprimerRelancesToutes")
    fichiers = sorted(p.name for p in (gi.dir / "Relances").glob("*.pdf"))
    assert fichiers == [f"Relance {A} 2027-01-15.pdf", f"Relance {B} 2027-01-15.pdf"]
    assert "2 relance" in gi.message()


def test_relances_selection(gi):
    gi.book.sheets["Impayés"].range("J8").value = "x"
    gi.run("modImpression.ImprimerRelancesSelection")
    assert [p.name for p in (gi.dir / "Relances").glob("*.pdf")] == [f"Relance {B} 2027-01-15.pdf"]


def test_aucune_relance_si_rien_du(gi):
    from datetime import datetime
    gi.set("DateReference", datetime(2026, 9, 15))
    gi.run("modImpression.ImprimerRelancesToutes")
    assert "Aucune relance" in gi.message()


def test_fiche_de_paie(gi):
    employe(gi, "Fatou", "Sow", 150000)
    gi.run("modPaie.GenererMois", "Octobre")
    gi.run("modImpression.ImprimerFiche", 1)
    pdf = gi.dir / "Paie" / "Fiche EMP-001 Octobre 2026.pdf"
    assert pdf.exists() and pages(pdf) == 1


def test_fiches_du_mois(gi):
    employe(gi, "Fatou", "Sow", 150000)
    employe(gi, "Ibou", "Fall", 120000)
    gi.run("modPaie.GenererMois", "Janvier")
    gi.set("BUL_Mois", "Janvier")
    gi.run("modImpression.ImprimerFichesMois")
    assert len(list((gi.dir / "Paie").glob("Fiche * Janvier 2027.pdf"))) == 2
```
Run: `cd excel && .venv/bin/python -m pytest tests/test_impression.py`
Expected: FAIL.

- [ ] **Step 2 : gabarits d'impression**

`excel/gen/sheets/modeles.py` :
```python
def _entete(book, ws):
    f = book.f
    ws.set_column(0, 0, 22)
    ws.set_column(1, 5, 14)
    ws.merge_range(0, 0, 0, 5, None, f["title"])
    ws.write_formula(0, 0, "=Ecole_Nom", f["title"])
    ws.write_formula(1, 0, "=Ecole_Adresse", f["info"])
    ws.write_formula(2, 0, '="Tél : "&Ecole_Tel1&IF(Ecole_Tel2="",""," / "&Ecole_Tel2)'
                           '&IF(Ecole_Email="","","   "&Ecole_Email)', f["info"])
    ws.write_formula(3, 0, '="Année scolaire "&AnneeActive', f["info"])


def _champs(book, sheet, ws, rows, value_col=1):
    f = book.f
    for row, label, name, fmt in rows:
        ws.write(row - 1, 0, label, f["label"])
        ws.write_blank(row - 1, value_col, None, f[fmt] if fmt else None)
        book.cell_name(name, sheet, f"{'ABCDEF'[value_col]}{row}")


def build_recu(book):
    s = "Modèle Reçu"
    ws = book.sheet(s, back_link=False)
    _entete(book, ws)
    ws.write(5, 0, "REÇU DE PAIEMENT", book.f["title"])
    ws.write(5, 4, "N°", book.f["label"])
    ws.write_blank(5, 5, None, book.f["label"])
    book.cell_name("R_Numero", s, "F6")
    _champs(book, s, ws, [
        (8, "Date", "R_Date", "date"),
        (9, "Élève", "R_Eleve", "label"),
        (10, "Matricule", "R_Matricule", None),
        (11, "Classe", "R_Classe", None),
        (12, "Frais", "R_Type", None),
        (13, "Mois", "R_Mois", None),
        (14, "Montant", "R_Montant", "money_b"),
        (15, "Note", "R_Note", None),
    ])
    ws.write(18, 3, "Signature et cachet", book.f["info"])
    ws.print_area("A1:F22")
    ws.set_paper(11)          # A5
    ws.fit_to_pages(1, 1)
    ws.hide_gridlines(2)


def build_relance(book):
    f = book.f
    s = "Modèle Relance"
    ws = book.sheet(s, back_link=False)
    _entete(book, ws)
    ws.write(5, 0, "LETTRE DE RELANCE", f["title"])
    _champs(book, s, ws, [
        (8, "Date", "REL_Date", "date"),
        (10, "À l'attention de", "REL_Parent", "label"),
        (11, "Téléphone", "REL_Tel", None),
        (13, "Élève", "REL_Eleve", "label"),
        (14, "Matricule", "REL_Matricule", None),
        (15, "Classe", "REL_Classe", None),
    ])
    ws.merge_range(16, 0, 17, 5, "Madame, Monsieur, sauf erreur de notre part, les frais suivants restent "
                                 "impayés pour votre enfant :", f["wrap"])
    ws.merge_range(18, 0, 19, 5, None, f["wrap"])
    book.cell_name("REL_Mois", s, "A19")
    ws.write(20, 0, "Montant restant dû", f["label"])
    ws.write_blank(20, 1, None, f["money_b"])
    book.cell_name("REL_Reste", s, "B21")
    ws.merge_range(22, 0, 23, 5, "Nous vous prions de bien vouloir régulariser cette situation dans les "
                                 "meilleurs délais auprès de la direction.", f["wrap"])
    ws.write(26, 3, "La Direction", f["label"])
    ws.print_area("A1:F30")
    ws.set_paper(9)           # A4
    ws.fit_to_pages(1, 1)
    ws.hide_gridlines(2)


def build_fiche(book):
    s = "Modèle Fiche de paie"
    ws = book.sheet(s, back_link=False)
    _entete(book, ws)
    ws.write(5, 0, "BULLETIN DE PAIE", book.f["title"])
    _champs(book, s, ws, [
        (7, "Période", "FP_Mois", "label"),
        (8, "Matricule", "FP_Matricule", None),
        (9, "Employé", "FP_Employe", "label"),
        (10, "Poste", "FP_Poste", None),
        (12, "Salaire de base", "FP_Base", "money"),
        (13, "Primes", "FP_Primes", "money"),
        (14, "Retenues", "FP_Retenues", "money"),
        (15, "Net à payer", "FP_Net", "money_b"),
        (17, "Statut", "FP_Paye", None),
    ])
    ws.write(19, 3, "Signature", book.f["info"])
    ws.print_area("A1:F22")
    ws.set_paper(11)
    ws.fit_to_pages(1, 1)
    ws.hide_gridlines(2)
```

Ajouter les boutons :
- dans `finances.build_paiements`, à la fin : `book.button(s, "F1", "Réimprimer le reçu (ligne sélectionnée)", "modImpression.ReimprimerSelection", 250)`
- dans `suivi.build_impayes`, à la fin : `book.button(s, "E1", "Imprimer les relances (sélection)", "modImpression.ImprimerRelancesSelection", 220)` et `book.button(s, "H1", "Imprimer toutes les relances", "modImpression.ImprimerRelancesToutes", 200)`
- dans `paie.build_bulletins`, à la fin : `book.button(s, "D4", "Imprimer la fiche (ligne sélectionnée)", "modImpression.ImprimerFicheSelection", 200)` et `book.button(s, "G4", "Imprimer les fiches du mois", "modImpression.ImprimerFichesMois", 230)`

Dans `excel/gen/build.py` : importer `modeles`, ajouter `modeles.build_recu, modeles.build_relance, modeles.build_fiche` après `parametres.build`, et `"modImpression.bas"` à la fin de `MODULES`.

- [ ] **Step 3 : modImpression.bas**

`excel/vba/modImpression.bas` :
```vba
Option Explicit
' Impression PDF : reçus, relances, fiches de paie.

Private Const IMP_DEBUT As Long = 7
Private Const IMP_FIN As Long = 1006
Private Const IMP_COL_MAT As Long = 2
Private Const IMP_COL_RESTE As Long = 8
Private Const IMP_COL_SEL As Long = 10

Private Function Exporter(ByVal ws As Worksheet, ByVal chemin As String) As String
    On Error GoTo Echec
    Application.Calculate
    ws.ExportAsFixedFormat Type:=0, Filename:=chemin
    Exporter = chemin
    Exit Function
Echec:
    Notifier "Impossible de créer le PDF : " & chemin & vbLf & Err.Description
    Exporter = ""
End Function

' ---------- Reçus ----------
Public Function ImprimerRecu(ByVal num As String) As String
    Dim lo As ListObject, i As Long
    Set lo = Tbl("tblPaiements")
    i = TrouverLigne(lo, "N° reçu", num)
    If i = 0 Then Notifier "Reçu introuvable : " & num: Exit Function
    DefinirChamp "R_Numero", num
    DefinirChamp "R_Date", Valeur(lo, i, "Date")
    DefinirChamp "R_Eleve", Valeur(lo, i, "Élève")
    DefinirChamp "R_Matricule", Valeur(lo, i, "Matricule")
    DefinirChamp "R_Classe", Valeur(lo, i, "Classe")
    DefinirChamp "R_Type", Valeur(lo, i, "Type de frais")
    DefinirChamp "R_Mois", Valeur(lo, i, "Mois")
    DefinirChamp "R_Montant", Valeur(lo, i, "Montant")
    DefinirChamp "R_Note", Valeur(lo, i, "Note")
    ImprimerRecu = Exporter(FeuilleDe("R_Numero"), Dossier("Recus") & NomFichier(num) & ".pdf")
End Function

Public Sub ReimprimerSelection()
    Dim lo As ListObject, i As Long, chemin As String
    On Error GoTo Erreur
    Set lo = Tbl("tblPaiements")
    If Intersect(ActiveCell, lo.DataBodyRange) Is Nothing Then
        Notifier "Sélectionnez une ligne du tableau des paiements.": Exit Sub
    End If
    i = ActiveCell.Row - lo.HeaderRowRange.Row
    chemin = ImprimerRecu(CStr(Valeur(lo, i, "N° reçu")))
    If chemin <> "" Then Notifier "Reçu créé : " & chemin
    Exit Sub
Erreur:
    Notifier "Erreur : " & Err.Description
End Sub

' ---------- Relances ----------
Public Function MoisImpayes(ByVal mat As String) As String
    Dim le As ListObject, gr As ListObject, pa As ListObject, iEl As Long, classe As String
    Dim nb As Long, m As Long, j As Long, nomMois As String, manque As Boolean, res As String
    Set le = Tbl("tblEleves"): Set gr = Tbl("tblGrille"): Set pa = Tbl("tblPaiements")
    iEl = TrouverLigne(le, "Matricule", mat)
    If iEl = 0 Then Exit Function
    classe = CStr(Valeur(le, iEl, "Classe"))
    nb = CLng(Nom("MoisEcoules"))
    For m = 1 To nb
        nomMois = MoisNom(m)
        manque = False
        For j = 1 To NombreLignes(gr)
            If CStr(Valeur(gr, j, "Classe")) = classe And Valeur(gr, j, "Obligatoire") = "Oui" _
               And Valeur(gr, j, "Périodicité") = "Mensuel" And Val(CStr(Valeur(gr, j, "Montant"))) > 0 Then
                If TrouverLigne(pa, "Clé", mat & "|" & Valeur(gr, j, "Type de frais") & "|" & nomMois) = 0 Then manque = True
            End If
        Next j
        If manque Then res = res & IIf(res = "", "", ", ") & nomMois
    Next m
    If nb >= 1 Then
        For j = 1 To NombreLignes(gr)
            If CStr(Valeur(gr, j, "Classe")) = classe And Valeur(gr, j, "Obligatoire") = "Oui" _
               And Valeur(gr, j, "Périodicité") = "Unique" And Val(CStr(Valeur(gr, j, "Montant"))) > 0 Then
                If TrouverLigne(pa, "Clé", mat & "|" & Valeur(gr, j, "Type de frais") & "|Unique") = 0 Then
                    res = res & IIf(res = "", "", ", ") & Valeur(gr, j, "Type de frais")
                End If
            End If
        Next j
    End If
    MoisImpayes = res
End Function

Public Sub TestMoisImpayes(ByVal mat As String)
    Notifier MoisImpayes(mat)
End Sub

Private Function ResteDu(ByVal mat As String) As Double
    Dim ws As Worksheet, v As Variant, i As Long
    Set ws = FeuilleDe("IMP_TotalReste")
    v = ws.Range(ws.Cells(IMP_DEBUT, IMP_COL_MAT), ws.Cells(IMP_FIN, IMP_COL_RESTE)).Value
    For i = 1 To UBound(v, 1)
        If CStr(v(i, 1)) = mat Then ResteDu = Val(CStr(v(i, IMP_COL_RESTE - IMP_COL_MAT + 1))): Exit Function
    Next i
End Function

Public Function ImprimerRelance(ByVal mat As String) As String
    Dim le As ListObject, i As Long, jour As Date
    Set le = Tbl("tblEleves")
    i = TrouverLigne(le, "Matricule", mat)
    If i = 0 Then Exit Function
    jour = CDate(Nom("DateCalcul"))
    DefinirChamp "REL_Date", jour
    DefinirChamp "REL_Parent", Valeur(le, i, "Parent prénom") & " " & Valeur(le, i, "Parent nom") & _
                               " (" & Valeur(le, i, "Relation") & ")"
    DefinirChamp "REL_Tel", CStr(Valeur(le, i, "Téléphone"))
    DefinirChamp "REL_Eleve", Valeur(le, i, "Prénom") & " " & Valeur(le, i, "Nom")
    DefinirChamp "REL_Matricule", mat
    DefinirChamp "REL_Classe", Valeur(le, i, "Classe")
    DefinirChamp "REL_Mois", MoisImpayes(mat)
    DefinirChamp "REL_Reste", ResteDu(mat)
    ImprimerRelance = Exporter(FeuilleDe("REL_Date"), Dossier("Relances") & _
        NomFichier("Relance " & mat & " " & Format$(jour, "yyyy-mm-dd")) & ".pdf")
End Function

Private Sub ImprimerRelances(ByVal seulementSelection As Boolean)
    Dim ws As Worksheet, v As Variant, i As Long, n As Long, mat As String, ok As Boolean
    On Error GoTo Erreur
    Application.Calculate
    Set ws = FeuilleDe("IMP_TotalReste")
    v = ws.Range(ws.Cells(IMP_DEBUT, 1), ws.Cells(IMP_FIN, IMP_COL_SEL)).Value
    For i = 1 To UBound(v, 1)
        mat = CStr(v(i, IMP_COL_MAT))
        If mat <> "" Then
            If seulementSelection Then
                ok = (LCase$(Trim$(CStr(v(i, IMP_COL_SEL)))) = "x")
            Else
                ok = (Val(CStr(v(i, IMP_COL_RESTE))) > 0)
            End If
            If ok Then
                If ImprimerRelance(mat) <> "" Then n = n + 1
            End If
        End If
    Next i
    If n = 0 Then
        Notifier "Aucune relance à imprimer."
    Else
        Notifier n & " relance(s) créée(s) dans " & Dossier("Relances")
    End If
    Exit Sub
Erreur:
    Notifier "Erreur : " & Err.Description
End Sub

Public Sub ImprimerRelancesSelection()
    ImprimerRelances True
End Sub

Public Sub ImprimerRelancesToutes()
    ImprimerRelances False
End Sub

' ---------- Fiches de paie ----------
Public Function ImprimerFiche(ByVal ligne As Long) As String
    Dim bu As ListObject, mois As String, an As Long, mat As String, periode As String
    Set bu = Tbl("tblBulletins")
    mois = CStr(Valeur(bu, ligne, "Mois"))
    mat = CStr(Valeur(bu, ligne, "Matricule"))
    an = CLng(Nom("AnneeDebut"))
    If IndexMois12(mois) > 3 Then an = an + 1
    periode = mois & " " & an
    DefinirChamp "FP_Mois", periode
    DefinirChamp "FP_Matricule", mat
    DefinirChamp "FP_Employe", Valeur(bu, ligne, "Employé")
    DefinirChamp "FP_Poste", ValeurDans(Tbl("tblEmployes"), "Matricule", mat, "Poste")
    DefinirChamp "FP_Base", Valeur(bu, ligne, "Salaire de base")
    DefinirChamp "FP_Primes", Valeur(bu, ligne, "Primes")
    DefinirChamp "FP_Retenues", Valeur(bu, ligne, "Retenues")
    DefinirChamp "FP_Net", Valeur(bu, ligne, "Net")
    If Valeur(bu, ligne, "Payé") = "Oui" And IsDate(Valeur(bu, ligne, "Date paiement")) Then
        DefinirChamp "FP_Paye", "Payé le " & Format$(Valeur(bu, ligne, "Date paiement"), "dd/mm/yyyy")
    Else
        DefinirChamp "FP_Paye", "Non payé"
    End If
    ImprimerFiche = Exporter(FeuilleDe("FP_Mois"), Dossier("Paie") & NomFichier("Fiche " & mat & " " & periode) & ".pdf")
End Function

Public Sub ImprimerFicheSelection()
    Dim bu As ListObject, chemin As String
    On Error GoTo Erreur
    Set bu = Tbl("tblBulletins")
    If Intersect(ActiveCell, bu.DataBodyRange) Is Nothing Then
        Notifier "Sélectionnez une ligne du tableau des bulletins.": Exit Sub
    End If
    chemin = ImprimerFiche(ActiveCell.Row - bu.HeaderRowRange.Row)
    If chemin <> "" Then Notifier "Fiche créée : " & chemin
    Exit Sub
Erreur:
    Notifier "Erreur : " & Err.Description
End Sub

Public Sub ImprimerFichesMois()
    Dim bu As ListObject, i As Long, n As Long, mois As String
    On Error GoTo Erreur
    mois = CStr(Champ("BUL_Mois"))
    Set bu = Tbl("tblBulletins")
    For i = 1 To NombreLignes(bu)
        If LCase$(CStr(Valeur(bu, i, "Mois"))) = LCase$(mois) Then
            If ImprimerFiche(i) <> "" Then n = n + 1
        End If
    Next i
    Notifier n & " fiche(s) créée(s) dans " & Dossier("Paie")
    Exit Sub
Erreur:
    Notifier "Erreur : " & Err.Description
End Sub
```

Reçu automatique — dans `excel/vba/modFinances.bas`, `EnregistrerPaiement` : déclarer `Dim chemin As String` et remplacer
```vba
    EffacerFormulaire "SP_"
    Notifier "Paiement enregistré : reçu " & num
```
par
```vba
    EffacerFormulaire "SP_"
    chemin = ImprimerRecu(num)
    If chemin <> "" Then
        Notifier "Paiement enregistré : reçu " & num & vbLf & "PDF : " & chemin
    Else
        Notifier "Paiement enregistré : reçu " & num & " (PDF non créé)."
    End If
```
Dans `excel/vba/modEleves.bas`, `Inscrire` : déclarer `Dim chemin As String` et remplacer
```vba
        Notifier "Élève inscrit : " & mat & vbLf & "Paiement enregistré : reçu " & num
```
par
```vba
        chemin = ImprimerRecu(num)
        Notifier "Élève inscrit : " & mat & vbLf & "Paiement enregistré : reçu " & num & _
                 IIf(chemin <> "", vbLf & "PDF : " & chemin, "")
```

- [ ] **Step 4 : construire et tester**

Run: `cd excel && .venv/bin/python -m gen.build && .venv/bin/python -m pytest`
Expected: tous les tests passent. Si `pages(pdf) > 1` : Excel Mac exporte tout le classeur — remplacer dans `Exporter` l'appel par `ws.Range(ws.PageSetup.PrintArea).ExportAsFixedFormat Type:=0, Filename:=chemin` et relancer.

- [ ] **Step 5 : commit**

```bash
git add excel/
git commit -m "feat(excel): reçus, relances et fiches de paie en PDF"
```

---

### Task 10: Tableau de bord et Accueil

**Files:**
- Create: `excel/gen/sheets/dashboard.py`
- Modify: `excel/gen/sheets/accueil.py` (remplacement complet), `excel/gen/build.py`
- Test: `excel/tests/test_dashboard.py`

**Interfaces:**
- Consumes: `tblEleves`, `tblClasses`, `tblPaiements`, `tblDepenses`, `tblEmployes`, `tblNiveaux`, `IMP_TotalReste`, `BIL_Solde`, feuille Bilan (A5:B14), `Ecole_Nom`, `AnneeActive`.
- Produces: noms `TB_Eleves`, `TB_Classes`, `TB_Paiements`, `TB_Depenses`, `TB_Employes`, `TB_Masse`, `TB_Impayes`, `TB_Solde` ; derniers paiements lignes 29–38 (A n° reçu … G montant) ; Accueil avec menu de liens (`accueil.MENU`).

- [ ] **Step 1 : tests (doivent échouer)**

`excel/tests/test_dashboard.py` :
```python
from datetime import datetime

from helpers import employe, inscrire, payer


def test_indicateurs(g):
    g.run("modFinances.RemplirGrille")
    inscrire(g, INS_Prenom="Awa")
    inscrire(g, INS_Prenom="Binta", INS_Classe="CP")
    payer(g, "ELV-2026-0001", "Scolarité", "Octobre", 25000, datetime(2026, 10, 5))
    payer(g, "ELV-2026-0002", "Scolarité", "Octobre", 25000, datetime(2026, 10, 6))
    g.add_row("tblDepenses", {"Date": datetime(2026, 10, 9), "Catégorie": "Divers", "Montant": 7000})
    employe(g, "Fatou", "Sow", 150000)
    assert g.get("TB_Eleves") == 2
    assert g.get("TB_Classes") == 13
    assert g.get("TB_Paiements") == 50000
    assert g.get("TB_Depenses") == 7000
    assert g.get("TB_Employes") == 1
    assert g.get("TB_Masse") == 150000
    assert g.get("TB_Impayes") == g.get("IMP_TotalReste")
    assert g.get("TB_Solde") == 50000 - 7000
    derniers = g.book.sheets["Tableau de bord"].range("A29:A31").value
    assert derniers[:2] == ["REC-2026-0002", "REC-2026-0001"]
    assert derniers[2] in (None, "")


def test_eleves_par_niveau(g):
    inscrire(g, INS_Classe="CI")
    inscrire(g, INS_Prenom="Binta", INS_Classe="Petite Section")
    vals = dict(g.book.sheets["Tableau de bord"].range("N12:O15").value)
    assert vals["Élémentaire"] == 1 and vals["Crèche"] == 1 and vals["Moyen"] == 0


def test_accueil_affiche_le_nom_de_l_ecole(g):
    g.set("Ecole_Nom", "Complexe Test")
    assert g.book.sheets["Accueil"].range("A1").value == "Complexe Test"
    assert "2026-2027" in g.book.sheets["Accueil"].range("A2").value
```
Run: `cd excel && .venv/bin/python -m pytest tests/test_dashboard.py`
Expected: FAIL.

- [ ] **Step 2 : Tableau de bord et Accueil**

`excel/gen/sheets/dashboard.py` :
```python
KPIS = [  # (ligne libellé, colonne, libellé, nom, formule)
    (3, 0, "Élèves actifs", "TB_Eleves", '=COUNTIFS(tblEleves[Année],AnneeActive,tblEleves[Statut],"Actif")'),
    (3, 2, "Classes", "TB_Classes", '=COUNTIF(tblClasses[Classe],"?*")'),
    (3, 4, "Paiements encaissés (FCFA)", "TB_Paiements", "=SUM(tblPaiements[Montant])"),
    (3, 6, "Dépenses (FCFA)", "TB_Depenses", "=SUM(tblDepenses[Montant])"),
    (6, 0, "Employés actifs", "TB_Employes", '=COUNTIFS(tblEmployes[Statut],"Actif")'),
    (6, 2, "Masse salariale mensuelle (FCFA)", "TB_Masse",
     '=SUMIFS(tblEmployes[Salaire de base],tblEmployes[Statut],"Actif")'),
    (6, 4, "Total impayés (FCFA)", "TB_Impayes", "=IMP_TotalReste"),
    (6, 6, "Solde de l'année (FCFA)", "TB_Solde", "=BIL_Solde"),
]
COLS_COL = "ABCDEFGH"
LAST = [("N° reçu", "N° reçu"), ("Date", "Date"), ("Élève", "Élève"), ("Classe", "Classe"),
        ("Type de frais", "Type"), ("Mois", "Mois"), ("Montant", "Montant")]


def build(book):
    f = book.f
    s = "Tableau de bord"
    ws = book.sheet(s, "Tableau de bord")
    for j in range(8):
        ws.set_column(j, j, 16)
    for row, col, label, name, formula in KPIS:
        ws.merge_range(row, col, row, col + 1, label, f["kpi_label"])
        ws.merge_range(row + 1, col, row + 1, col + 1, None, f["kpi_value"])
        ws.write_formula(row + 1, col, formula, f["kpi_value"])
        book.cell_name(name, s, f"{COLS_COL[col]}{row + 2}")

    # Élèves par niveau (données du camembert), N12:O17
    ws.write(10, 13, "Niveau", f["hdr"])
    ws.write(10, 14, "Élèves", f["hdr"])
    for k in range(1, 7):
        r = 11 + k
        ws.write_formula(r - 1, 13, f'=IFERROR(INDEX(tblNiveaux[Niveau],{k})&"","")')
        ws.write_formula(r - 1, 14, f'=IF(N{r}="","",COUNTIFS(tblEleves[Niveau],N{r},'
                                    f'tblEleves[Année],AnneeActive,tblEleves[Statut],"Actif"))')
    bar = book.wb.add_chart({"type": "column"})
    bar.add_series({"name": "Paiements", "categories": "='Bilan'!$A$5:$A$14",
                    "values": "='Bilan'!$B$5:$B$14", "fill": {"color": "#1F4E79"}})
    bar.set_title({"name": "Paiements encaissés par mois"})
    bar.set_legend({"none": True})
    ws.insert_chart("A10", bar, {"x_scale": 1.3, "y_scale": 1.0})
    pie = book.wb.add_chart({"type": "pie"})
    pie.add_series({"name": "Élèves par niveau", "categories": f"='{s}'!$N$12:$N$17",
                    "values": f"='{s}'!$O$12:$O$17", "data_labels": {"value": True}})
    pie.set_title({"name": "Élèves par niveau"})
    ws.insert_chart("F10", pie)

    # 10 derniers paiements, lignes 29-38
    ws.write(26, 0, "Derniers paiements", f["h2"])
    for j, (h, _) in enumerate(LAST):
        ws.write(27, j, h, f["hdr"])
    for k in range(1, 11):
        r = 28 + k
        idx = f"ROWS(tblPaiements)-{k - 1}"
        for j, (col, _) in enumerate(LAST):
            fmt = f["date"] if col == "Date" else f["money"] if col == "Montant" else None
            ws.write_formula(r - 1, j, f'=IFERROR(IF({idx}<1,"",IF(INDEX(tblPaiements[N° reçu],{idx})="","",'
                                       f'INDEX(tblPaiements[{col}],{idx}))),"")', fmt)
```

`excel/gen/sheets/accueil.py` (remplace la version provisoire) :
```python
MENU = [  # (titre de section, [(libellé, feuille)])
    ("Scolarité", [("Inscription", "Inscription"), ("Élèves", "Élèves"), ("Classes", "Classes")]),
    ("Finances", [("Encaisser un paiement", "Saisie paiement"), ("Paiements", "Paiements"),
                  ("Suivi", "Suivi"), ("Impayés", "Impayés"), ("Grille tarifaire", "Grille tarifaire"),
                  ("Dépenses", "Dépenses"), ("Recettes", "Recettes"), ("Bilan", "Bilan")]),
    ("Paie", [("Employés", "Employés"), ("Bulletins", "Bulletins"), ("Historique", "Historique paie")]),
    ("Transport", [("Véhicules", "Véhicules"), ("Itinéraires", "Itinéraires"),
                   ("Affectations", "Affectations")]),
    ("Général", [("Tableau de bord", "Tableau de bord"), ("Paramètres", "Paramètres")]),
]


def build(book):
    f = book.f
    ws = book.sheet("Accueil", back_link=False)
    ws.write_formula(0, 0, "=Ecole_Nom", f["title"])
    ws.write_formula(1, 0, '="Gestion Ecole — Année scolaire "&AnneeActive', f["subtitle"])
    ws.hide_gridlines(2)
    for k, (section, links) in enumerate(MENU):
        col = k * 2
        ws.set_column(col, col, 26)
        ws.set_column(col + 1, col + 1, 3)
        ws.write(3, col, section, f["h2"])
        for i, (label, sheet) in enumerate(links):
            row = 4 + i
            ws.set_row(row, 30)
            ws.write_url(row, col, f"internal:'{sheet}'!A1", f["menu"], string=label)
    ws.activate()
```

Dans `excel/gen/build.py` : importer `dashboard` et placer `dashboard.build` juste après `accueil.build`.

- [ ] **Step 3 : construire et tester**

Run: `cd excel && .venv/bin/python -m gen.build && .venv/bin/python -m pytest`
Expected: tous les tests passent.

- [ ] **Step 4 : commit**

```bash
git add excel/
git commit -m "feat(excel): tableau de bord et menu d'accueil"
```

---

### Task 11: Sauvegarde automatique

**Files:**
- Create: `excel/vba/modSauvegarde.bas`, `excel/vba/ThisWorkbook.bas`
- Modify: `excel/gen/sheets/accueil.py` (bouton), `excel/gen/build.py`
- Test: `excel/tests/test_sauvegarde.py`

**Interfaces:**
- Consumes: modUtil (`Dossier`, `ModeTest`, `Notifier`).
- Produces: `modSauvegarde.Sauvegarder() As String` (chemin de la copie), `modSauvegarde.SauvegarderMaintenant` ; événements `Workbook_Open` (va à l'Accueil, recalcul automatique) et `Workbook_BeforeClose` (sauvegarde sauf en mode test) ; copies `Sauvegardes/Gestion Ecole aaaa-mm-jj hhnnss.xlsm`, 30 gardées.

- [ ] **Step 1 : tests (doivent échouer)**

`excel/tests/test_sauvegarde.py` :
```python
import shutil

from gen import paths
from gen.excel_driver import excel_app


def test_sauvegarde_manuelle(g):
    g.run("modSauvegarde.SauvegarderMaintenant")
    copies = list((g.dir / "Sauvegardes").glob("Gestion Ecole *.xlsm"))
    assert len(copies) == 1
    assert copies[0].name in g.message()


def test_purge_garde_30_copies(g):
    d = g.dir / "Sauvegardes"
    d.mkdir()
    for n in range(31):
        (d / f"Gestion Ecole 2020-01-01 0000{n:02d}.xlsm").write_bytes(b"x")
    g.run("modSauvegarde.SauvegarderMaintenant")
    noms = sorted(p.name for p in d.glob("Gestion Ecole *.xlsm"))
    assert len(noms) == 30
    assert "Gestion Ecole 2020-01-01 000000.xlsm" not in noms
    assert "Gestion Ecole 2020-01-01 000001.xlsm" not in noms


def test_sauvegarde_a_la_fermeture():
    folder = paths.RUNS / "fermeture"
    shutil.rmtree(folder, ignore_errors=True)
    folder.mkdir(parents=True)
    path = folder / "Gestion Ecole.xlsm"
    shutil.copy(paths.DIST_XLSM, path)
    app = excel_app()
    app.display_alerts = False
    book = app.books.open(str(path))
    book.close()
    assert len(list((folder / "Sauvegardes").glob("Gestion Ecole *.xlsm"))) == 1
```
Run: `cd excel && .venv/bin/python -m pytest tests/test_sauvegarde.py`
Expected: FAIL.

- [ ] **Step 2 : VBA sauvegarde**

`excel/vba/modSauvegarde.bas` :
```vba
Option Explicit
' Copies de sauvegarde datées du classeur.

Private Const GARDER As Long = 30

Public Function Sauvegarder() As String
    Dim d As String, base As String, chemin As String, n As Long
    d = Dossier("Sauvegardes")
    base = d & "Gestion Ecole " & Format$(Now, "yyyy-mm-dd hhnnss")
    chemin = base & ".xlsm"
    Do While Len(Dir(chemin)) > 0
        n = n + 1
        chemin = base & "-" & n & ".xlsm"
    Loop
    ThisWorkbook.SaveCopyAs chemin
    Purger d
    Sauvegarder = chemin
End Function

Public Sub SauvegarderMaintenant()
    On Error GoTo Erreur
    Notifier "Sauvegarde créée : " & Sauvegarder()
    Exit Sub
Erreur:
    Notifier "Erreur de sauvegarde : " & Err.Description
End Sub

Private Sub Purger(ByVal d As String)
    Dim noms() As String, nb As Long, f As String, i As Long, j As Long, tmp As String
    f = Dir(d)
    Do While f <> ""
        If f Like "Gestion Ecole *.xlsm" Then
            nb = nb + 1
            ReDim Preserve noms(1 To nb)
            noms(nb) = f
        End If
        f = Dir()
    Loop
    If nb <= GARDER Then Exit Sub
    For i = 1 To nb - 1
        For j = i + 1 To nb
            If noms(j) < noms(i) Then tmp = noms(i): noms(i) = noms(j): noms(j) = tmp
        Next j
    Next i
    For i = 1 To nb - GARDER
        Kill d & noms(i)
    Next i
End Sub
```

`excel/vba/ThisWorkbook.bas` (code du module ThisWorkbook, injecté par le Builder) :
```vba
Option Explicit

Private Sub Workbook_Open()
    On Error Resume Next
    Application.Calculation = -4105
    ThisWorkbook.Worksheets("Accueil").Activate
End Sub

Private Sub Workbook_BeforeClose(Cancel As Boolean)
    On Error Resume Next
    If ModeTest() Then Exit Sub
    Sauvegarder
End Sub
```

Dans `excel/gen/sheets/accueil.py`, à la fin de `build` : `book.button("Accueil", "J1", "Sauvegarder maintenant", "modSauvegarde.SauvegarderMaintenant", 170)`.
Dans `excel/gen/build.py` : ajouter `"modSauvegarde.bas"` puis `"ThisWorkbook.bas"` à la fin de `MODULES`.

- [ ] **Step 3 : construire et tester**

Run: `cd excel && .venv/bin/python -m gen.build && .venv/bin/python -m pytest`
Expected: tous les tests passent.

- [ ] **Step 4 : commit**

```bash
git add excel/
git commit -m "feat(excel): sauvegarde automatique à la fermeture"
```

---

### Task 12: Nouvelle année scolaire

**Files:**
- Create: `excel/vba/modAnnee.bas`
- Modify: `excel/gen/sheets/parametres.py` (bouton), `excel/gen/build.py`
- Test: `excel/tests/test_nouvelle_annee.py`

**Interfaces:**
- Consumes: modUtil (`ViderTable`, `Dossier`, `Confirmer`), `modSauvegarde.Sauvegarder`, `tblEleves`, `tblClasses[Classe suivante]`, `tblAnnees`, `AnneeActive`.
- Produces: `modAnnee.AnneeSuivante(lib) As String`, `modAnnee.NouvelleAnnee` ; fichier `Archives/Gestion Ecole - <année>.xlsx` (une feuille par tableau : Élèves, Paiements, Dépenses, Recettes, Bulletins, Affectations, Grille tarifaire, Classes).

- [ ] **Step 1 : tests (doivent échouer)**

`excel/tests/test_nouvelle_annee.py` :
```python
from datetime import datetime

import openpyxl
import pytest

from helpers import employe, inscrire, libelle, payer


@pytest.fixture
def gn(g):
    g.run("modFinances.RemplirGrille")
    inscrire(g, INS_Prenom="Awa", INS_Classe="CI")          # 0001
    inscrire(g, INS_Prenom="Binta", INS_Classe="3ème")      # 0002 -> sortante
    inscrire(g, INS_Prenom="Cheikh", INS_Classe="CP")       # 0003 -> inactif
    g.cell("tblEleves", 3, "Statut").value = "Inactif"
    payer(g, "ELV-2026-0001", "Scolarité", "Octobre", 25000, datetime(2026, 10, 5))
    g.add_row("tblDepenses", {"Date": datetime(2026, 10, 9), "Catégorie": "Divers", "Montant": 7000})
    employe(g, "Fatou", "Sow", 150000)
    g.run("modPaie.GenererMois", "Octobre")
    return g


def test_refus_ne_change_rien(gn):
    gn.set("CFG_ReponseTest", "Non")
    gn.run("modAnnee.NouvelleAnnee")
    assert gn.get("AnneeActive") == "2026-2027"
    assert len(gn.rows("tblPaiements")) == 1


def test_passage(gn):
    gn.run("modAnnee.NouvelleAnnee")
    assert gn.get("AnneeActive") == "2027-2028"
    assert gn.eval("AnneeDebut") == 2027
    assert "2027-2028" in [r["Libellé"] for r in gn.rows("tblAnnees")]
    el = {r["Matricule"]: r for r in gn.rows("tblEleves")}
    assert (el["ELV-2026-0001"]["Classe"], el["ELV-2026-0001"]["Année"]) == ("CP", "2027-2028")
    assert (el["ELV-2026-0002"]["Statut"], el["ELV-2026-0002"]["Année"]) == ("Inactif", "2026-2027")
    assert (el["ELV-2026-0003"]["Classe"], el["ELV-2026-0003"]["Année"]) == ("CP", "2026-2027")
    for t in ["tblPaiements", "tblDepenses", "tblRecettes", "tblBulletins", "tblAffectations"]:
        assert gn.rows(t) == [], t
    assert len(gn.rows("tblGrille")) == 65
    assert len(list((gn.dir / "Sauvegardes").glob("*.xlsm"))) == 1


def test_archive(gn):
    gn.run("modAnnee.NouvelleAnnee")
    arch = gn.dir / "Archives" / "Gestion Ecole - 2026-2027.xlsx"
    assert arch.exists()
    wb = openpyxl.load_workbook(arch, read_only=True)
    assert {"Élèves", "Paiements", "Dépenses", "Bulletins", "Grille tarifaire"} <= set(wb.sheetnames)
    rows = list(wb["Paiements"].iter_rows(values_only=True))
    assert rows[0][0] == "N° reçu" and rows[1][0] == "REC-2026-0001"


def test_saisies_apres_passage(gn):
    gn.run("modAnnee.NouvelleAnnee")
    payer(gn, "ELV-2026-0001", "Scolarité", "Octobre", 25000)
    assert [r["N° reçu"] for r in gn.rows("tblPaiements")] == ["REC-2027-0001"]
    inscrire(gn, INS_Prenom="Diarra")
    assert gn.rows("tblEleves")[-1]["Matricule"] == "ELV-2027-0001"
    cp = next(r for r in gn.rows("tblClasses") if r["Classe"] == "CP")
    assert cp["Effectif"] == 1  # Awa promue ; Cheikh (inactif, année 2026-2027) exclu
```
Run: `cd excel && .venv/bin/python -m pytest tests/test_nouvelle_annee.py`
Expected: FAIL.

- [ ] **Step 2 : modAnnee.bas**

`excel/vba/modAnnee.bas` :
```vba
Option Explicit
' Clôture de l'année et passage à l'année suivante.

Public Function AnneeSuivante(ByVal lib As String) As String
    Dim a As Long
    a = CLng(Left$(lib, 4))
    AnneeSuivante = (a + 1) & "-" & (a + 2)
End Function

Private Function Archiver(ByVal lib As String) As String
    Dim wbA As Workbook, t As Variant, lo As ListObject, ws As Worksheet, chemin As String, premier As Boolean
    chemin = Dossier("Archives") & "Gestion Ecole - " & lib & ".xlsx"
    Set wbA = Workbooks.Add
    premier = True
    For Each t In Array("tblEleves", "tblPaiements", "tblDepenses", "tblRecettes", "tblBulletins", _
                        "tblAffectations", "tblGrille", "tblClasses")
        Set lo = Tbl(CStr(t))
        If premier Then
            Set ws = wbA.Worksheets(1)
            premier = False
        Else
            Set ws = wbA.Worksheets.Add(After:=wbA.Worksheets(wbA.Worksheets.Count))
        End If
        ws.Name = lo.Parent.Name
        ws.Range("A1").Resize(lo.Range.Rows.Count, lo.Range.Columns.Count).Value = lo.Range.Value
    Next t
    Application.DisplayAlerts = False
    wbA.SaveAs Filename:=chemin, FileFormat:=51
    wbA.Close SaveChanges:=False
    Application.DisplayAlerts = True
    ThisWorkbook.Activate
    Archiver = chemin
End Function

Private Sub PromouvoirEleves(ByVal ancienne As String, ByVal nouvelle As String)
    Dim le As ListObject, cl As ListObject, i As Long, suivante As String
    Set le = Tbl("tblEleves"): Set cl = Tbl("tblClasses")
    For i = 1 To NombreLignes(le)
        If CStr(Valeur(le, i, "Année")) = ancienne And Valeur(le, i, "Statut") = "Actif" Then
            suivante = Trim$(CStr(ValeurDans(cl, "Classe", Valeur(le, i, "Classe"), "Classe suivante")))
            If suivante = "" Then
                Ecrire le, i, "Statut", "Inactif"
            Else
                Ecrire le, i, "Classe", suivante
                Ecrire le, i, "Année", nouvelle
            End If
        End If
    Next i
End Sub

Private Sub AjouterAnnee(ByVal lib As String)
    Dim lo As ListObject, i As Long, a As Long
    Set lo = Tbl("tblAnnees")
    If TrouverLigne(lo, "Libellé", lib) > 0 Then Exit Sub
    a = CLng(Left$(lib, 4))
    i = NouvelleLigne(lo)
    Ecrire lo, i, "Libellé", lib
    Ecrire lo, i, "Date début", DateSerial(a, 10, 1)
    Ecrire lo, i, "Date fin", DateSerial(a + 1, 7, 31)
End Sub

Public Sub NouvelleAnnee()
    Dim ancienne As String, nouvelle As String, archive As String, t As Variant
    On Error GoTo Erreur
    ancienne = CStr(Nom("AnneeActive"))
    nouvelle = AnneeSuivante(ancienne)
    If Not Confirmer("Clôturer l'année " & ancienne & " et passer à " & nouvelle & " ?" & vbLf & _
        "Paiements, dépenses, recettes, bulletins et affectations seront archivés puis vidés ; " & _
        "les élèves actifs passeront dans leur classe suivante.") Then Exit Sub
    Sauvegarder
    Debut
    archive = Archiver(ancienne)
    PromouvoirEleves ancienne, nouvelle
    AjouterAnnee nouvelle
    DefinirChamp "AnneeActive", nouvelle
    For Each t In Array("tblPaiements", "tblDepenses", "tblRecettes", "tblBulletins", "tblAffectations")
        ViderTable Tbl(CStr(t))
    Next t
    Fin
    Notifier "Nouvelle année active : " & nouvelle & vbLf & "Archive : " & archive
    Exit Sub
Erreur:
    Fin
    Application.DisplayAlerts = True
    Notifier "Erreur pendant le passage d'année : " & Err.Description & vbLf & _
             "Une sauvegarde a été faite dans le dossier « Sauvegardes »."
End Sub
```

Dans `excel/gen/sheets/parametres.py`, à la fin de `build` : `book.button(SHEET, "D11", "Nouvelle année scolaire…", "modAnnee.NouvelleAnnee", 190)`.
Dans `excel/gen/build.py` : ajouter `"modAnnee.bas"` à `MODULES` juste avant `"ThisWorkbook.bas"`.

- [ ] **Step 3 : construire et tester**

Run: `cd excel && .venv/bin/python -m gen.build && .venv/bin/python -m pytest`
Expected: tous les tests passent.

- [ ] **Step 4 : commit**

```bash
git add excel/
git commit -m "feat(excel): passage à l'année scolaire suivante avec archive"
```

---

### Task 13: Logo, guide d'utilisation, checklist Windows, livraison

**Files:**
- Create: `excel/vba/modParams.bas`, `excel/gen/sheets/aide.py`, `excel/dist/Checklist Windows.md`
- Modify: `excel/gen/sheets/parametres.py` (bouton logo), `excel/gen/sheets/accueil.py` (lien Aide), `excel/gen/build.py` (`GUIDE = True`, aide, modParams)
- Test: `excel/tests/test_logo.py`, `excel/tests/test_pipeline.py` (guide)

**Interfaces:**
- Consumes: `Ecole_Logo`, feuilles Accueil et modèles.
- Produces: `modParams.MettreAJourLogo` (forme nommée « Logo » en G1 de Accueil, Modèle Reçu, Modèle Relance, Modèle Fiche de paie) ; feuille « Aide » ; `dist/Guide d'utilisation.pdf` ; `dist/Checklist Windows.md`.

- [ ] **Step 1 : tests (doivent échouer)**

`excel/tests/test_logo.py` :
```python
import struct
import zlib


def png(path, w=40, h=40):
    raw = b"".join(b"\x00" + b"\x1f\x4e\x79" * w for _ in range(h))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    data = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))
    path.write_bytes(data)


def test_logo_place_sur_les_feuilles(g):
    logo = g.dir / "logo.png"
    png(logo)
    g.set("Ecole_Logo", str(logo))
    g.run("modParams.MettreAJourLogo")
    for feuille in ["Accueil", "Modèle Reçu", "Modèle Relance", "Modèle Fiche de paie"]:
        g.run("modUtil.TestExisteForme", feuille, "Logo")
        assert g.message() == "1", feuille
    g.run("modParams.MettreAJourLogo")  # remplacement, pas de doublon
    g.run("modUtil.TestExisteForme", "Accueil", "Logo")
    assert g.message() == "1"


def test_logo_introuvable(g):
    g.set("Ecole_Logo", str(g.dir / "absent.png"))
    g.run("modParams.MettreAJourLogo")
    assert "introuvable" in g.message()
```
Ajouter à `excel/tests/test_pipeline.py` :
```python
from gen import paths


def test_guide_pdf_livre():
    assert paths.DIST_GUIDE.exists() and paths.DIST_GUIDE.stat().st_size > 1000


def test_aucune_fonction_recente_dans_les_formules():
    import re
    import zipfile
    with zipfile.ZipFile(paths.DIST_XLSM) as z:
        xml = "".join(z.read(n).decode("utf-8", "ignore") for n in z.namelist() if n.endswith(".xml"))
    assert not re.search(r"_xlfn\.|_xlws\.", xml)
```
Run: `cd excel && .venv/bin/python -m pytest tests/test_logo.py tests/test_pipeline.py`
Expected: FAIL.

- [ ] **Step 2 : modParams.bas**

`excel/vba/modParams.bas` :
```vba
Option Explicit
' Paramètres de l'école.

Public Sub MettreAJourLogo()
    Dim chemin As Variant, feuille As Variant, ws As Worksheet, shp As Object
    On Error GoTo Erreur
    chemin = Trim$(CStr(Champ("Ecole_Logo")))
    If chemin = "" And Not ModeTest() Then
        chemin = Application.GetOpenFilename()
        If VarType(chemin) = vbBoolean Then Exit Sub
        DefinirChamp "Ecole_Logo", chemin
    End If
    If chemin = "" Or Len(Dir(CStr(chemin))) = 0 Then
        Notifier "Fichier du logo introuvable : " & chemin: Exit Sub
    End If
    For Each feuille In Array("Accueil", "Modèle Reçu", "Modèle Relance", "Modèle Fiche de paie")
        Set ws = ThisWorkbook.Worksheets(CStr(feuille))
        On Error Resume Next
        ws.Shapes("Logo").Delete
        On Error GoTo Erreur
        Set shp = ws.Shapes.AddPicture(CStr(chemin), False, True, ws.Range("G1").Left, ws.Range("G1").Top, -1, -1)
        shp.Name = "Logo"
        shp.LockAspectRatio = True
        shp.Height = 60
    Next feuille
    Notifier "Logo mis à jour."
    Exit Sub
Erreur:
    Notifier "Erreur : " & Err.Description
End Sub
```

Dans `excel/gen/sheets/parametres.py`, à la fin de `build` : `book.button(SHEET, "D8", "Mettre à jour le logo", "modParams.MettreAJourLogo", 170)`.

- [ ] **Step 3 : feuille Aide (guide)**

`excel/gen/sheets/aide.py` :
```python
GUIDE = [
    ("Démarrer", [
        "Ouvrez « Gestion Ecole.xlsm » et cliquez sur « Activer le contenu » (bandeau jaune) pour activer les macros.",
        "Si Windows bloque les macros (fichier reçu par e-mail ou téléchargé) : fermez Excel, clic droit sur le "
        "fichier → Propriétés → cochez « Débloquer » → OK, puis rouvrez.",
        "Dans « Paramètres », saisissez le nom de l'école, l'adresse, les téléphones, puis « Mettre à jour le logo ».",
        "Dans « Grille tarifaire », cliquez sur « Remplir avec les montants par défaut » puis ajustez les montants.",
    ]),
    ("Inscrire un élève", [
        "Feuille « Inscription » : remplissez les cases jaunes (* = obligatoire) puis « Inscrire l'élève ».",
        "Le matricule est créé automatiquement. Si un montant d'inscription est saisi, le reçu est créé.",
        "Pour corriger un élève ou changer son statut (Actif, Inactif, Transféré) : feuille « Élèves ».",
    ]),
    ("Encaisser un paiement", [
        "Feuille « Saisie paiement » : choisissez l'élève, le type de frais et le mois (« Unique » pour un frais "
        "non mensuel), cliquez sur « Proposer le montant de la grille », puis « Enregistrer le paiement ».",
        "Le reçu PDF est enregistré dans le dossier « Recus » à côté du classeur. Un même mois ne peut pas être "
        "payé deux fois pour le même frais.",
        "Pour réimprimer un reçu : feuille « Paiements », cliquez sur la ligne puis « Réimprimer le reçu ».",
    ]),
    ("Suivi, impayés et relances", [
        "« Suivi » : choisissez une classe et un type de frais ; vert = payé, rouge = mois écoulé non payé.",
        "« Impayés » : montant dû, payé et restant pour chaque élève actif (frais obligatoires).",
        "« Imprimer toutes les relances » crée une lettre PDF par élève en retard dans le dossier « Relances ». "
        "Pour quelques élèves seulement, mettez « x » dans « Sélection » puis « Imprimer les relances (sélection) ».",
    ]),
    ("Paie", [
        "« Employés » : « Nouvel employé » puis complétez la ligne (salaire de base, statut).",
        "« Bulletins » : choisissez le mois puis « Générer les bulletins du mois ». Modifiez primes et retenues "
        "dans le tableau. Sélectionnez des lignes puis « Marquer payé ».",
        "Fiches de paie PDF : « Imprimer la fiche » (ligne sélectionnée) ou « Imprimer les fiches du mois » "
        "(dossier « Paie »).",
    ]),
    ("Dépenses, recettes et bilan", [
        "Saisissez dépenses et recettes directement dans leurs tableaux (une ligne par opération).",
        "« Bilan » : paiements + recettes − dépenses − salaires payés, mois par mois.",
    ]),
    ("Transport", [
        "Créez les véhicules, puis les itinéraires et leurs arrêts.",
        "« Affectations » : choisissez l'élève, l'itinéraire et l'arrêt, puis « Affecter l'élève ».",
    ]),
    ("Nouvelle année scolaire", [
        "En fin d'année : « Paramètres » → « Nouvelle année scolaire… ».",
        "Une sauvegarde est faite, l'année est archivée dans le dossier « Archives », les journaux sont vidés et "
        "les élèves actifs passent dans leur « classe suivante » (définie dans « Classes »).",
    ]),
    ("Sauvegardes", [
        "À chaque fermeture, une copie datée est enregistrée dans « Sauvegardes » (30 dernières conservées).",
        "Pour restaurer : fermez Excel, copiez la sauvegarde voulue à la place de « Gestion Ecole.xlsm ».",
        "Conseil : copiez régulièrement le dossier complet sur une clé USB.",
    ]),
]


def build(book):
    f = book.f
    s = "Aide"
    ws = book.sheet(s, "Guide d'utilisation — Gestion Ecole")
    ws.set_column(0, 0, 110, f["wrap"])
    row = 3
    for section, lines in GUIDE:
        ws.write(row, 0, section, f["h2"])
        row += 1
        for line in lines:
            ws.write(row, 0, "• " + line, f["wrap"])
            row += 1
        row += 1
    ws.print_area(0, 0, row, 0)
    ws.set_paper(9)
    ws.fit_to_pages(1, 0)
    ws.hide_gridlines(2)
```

Dans `excel/gen/sheets/accueil.py`, ligne « Général » du `MENU` : `[("Tableau de bord", "Tableau de bord"), ("Paramètres", "Paramètres"), ("Aide", "Aide")]`.
Dans `excel/gen/build.py` : importer `aide`, ajouter `aide.build` en dernier dans `SHEET_BUILDERS`, ajouter `"modParams.bas"` juste avant `"ThisWorkbook.bas"` dans `MODULES`, et passer `GUIDE = True`.

État final attendu de `excel/gen/build.py` (listes) :
```python
from .sheets import (accueil, aide, compta, config, dashboard, finances, modeles, paie, parametres,
                     scolarite, suivi, transport)

SHEET_BUILDERS = [
    accueil.build,
    dashboard.build,
    scolarite.build_inscription,
    scolarite.build_eleves,
    scolarite.build_classes,
    finances.build_saisie_paiement,
    finances.build_paiements,
    suivi.build_suivi,
    suivi.build_impayes,
    finances.build_grille,
    compta.build_depenses,
    compta.build_recettes,
    compta.build_bilan,
    paie.build_employes,
    paie.build_bulletins,
    paie.build_historique,
    transport.build_vehicules,
    transport.build_itineraires,
    transport.build_affectations,
    parametres.build,
    modeles.build_recu,
    modeles.build_relance,
    modeles.build_fiche,
    aide.build,
]

MODULES = ["modUtil.bas", "modIds.bas", "modEleves.bas", "modFinances.bas", "modPaie.bas",
           "modTransport.bas", "modImpression.bas", "modSauvegarde.bas", "modAnnee.bas",
           "modParams.bas", "ThisWorkbook.bas"]

GUIDE = True
```

- [ ] **Step 4 : checklist Windows**

`excel/dist/Checklist Windows.md` :
```markdown
# Checklist de validation sur le PC Windows (≈ 10 min)

Travailler sur une **copie** de « Gestion Ecole.xlsm » placée dans un dossier dédié (ex. `Documents\Gestion Ecole\`).

1. [ ] Clic droit sur le fichier → Propriétés → cocher « Débloquer » si la case existe → OK.
2. [ ] Ouvrir le fichier, cliquer « Activer le contenu ». L'onglet « Accueil » s'affiche.
3. [ ] Accueil : chaque lien du menu ouvre la bonne feuille ; « ← Accueil » ramène au menu.
4. [ ] Paramètres : saisir le nom de l'école ; « Mettre à jour le logo » avec une image → logo visible sur l'Accueil.
5. [ ] Grille tarifaire : « Remplir avec les montants par défaut » → 65 lignes.
6. [ ] Inscription : inscrire un élève avec 50 000 d'inscription → message avec matricule et reçu ; `Recus\REC-…pdf` existe et s'ouvre (1 page, en-tête de l'école).
7. [ ] Saisie paiement : Scolarité / Octobre → reçu PDF ; refaire le même paiement → refus « Déjà payé ».
8. [ ] Suivi (classe de l'élève) : Octobre en vert. Impayés : l'élève apparaît avec un reste cohérent ; « Imprimer toutes les relances » → PDF dans `Relances\`.
9. [ ] Employés → Nouvel employé (salaire 100 000) ; Bulletins → Générer, Marquer payé, Imprimer la fiche → PDF dans `Paie\`.
10. [ ] Bilan et Tableau de bord : montants cohérents, graphiques affichés.
11. [ ] Transport : véhicule, itinéraire, arrêt, affecter l'élève.
12. [ ] Fermer Excel → `Sauvegardes\` contient une copie datée.
13. [ ] Sur la copie : Paramètres → « Nouvelle année scolaire… » → `Archives\Gestion Ecole - 2026-2027.xlsx` créé, année active 2027-2028, élève passé en classe suivante.

Noter tout message d'erreur (capture d'écran) et le numéro de l'étape.
```

- [ ] **Step 5 : construction finale et suite complète**

Run: `cd excel && .venv/bin/python -m gen.build && .venv/bin/python -m pytest`
Expected: `OK -> …/dist/Gestion Ecole.xlsm`, `dist/Guide d'utilisation.pdf` créé, toute la suite passe (0 échec). Ouvrir le guide PDF et vérifier visuellement qu'il est lisible (pas de texte coupé).

- [ ] **Step 6 : commit de livraison**

```bash
git add excel/
git commit -m "feat(excel): logo, guide d'utilisation, checklist Windows et classeur livré"
```
