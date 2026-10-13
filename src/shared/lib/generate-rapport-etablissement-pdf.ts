import { jsPDF } from "jspdf";
import { LIBELLES_TYPE_REDUCTION, type Reduction } from "@/modules/finance/reductions";
import type { RapportEtablissement } from "@/modules/reports/types";
import type { Parametres } from "@/modules/settings/service";
import { formatMontantPdf as cfa, dessinerEnTeteEcole } from "./pdf-entete";
import { paginer, paragraphe, tableau, titreRapport, titreSection } from "./pdf-tableau";
import { MOIS_LABELS } from "./utils";

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)} %` : "—");
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function buildRapportEtablissementPdf(r: RapportEtablissement, ecole: Parametres): jsPDF {
	const doc = new jsPDF({ unit: "mm", format: "a4" });
	let y = dessinerEnTeteEcole(doc, ecole);
	y = titreRapport(doc, y, "Rapport de l'établissement", `Année scolaire ${r.annee.libelle}`);

	// 1. Effectifs
	y = titreSection(doc, y, "1. Effectifs");
	if (!r.effectifs.length) y = paragraphe(doc, y, "Aucune classe pour cette année.");
	else {
		const somme = (k: "garcons" | "filles" | "total" | "capacite") =>
			r.effectifs.reduce((t, e) => t + e[k], 0);
		y = tableau(
			doc,
			y,
			[
				{ titre: "Niveau", largeur: 35 },
				{ titre: "Classe", largeur: 0 },
				{ titre: "Garçons", largeur: 22, align: "right" },
				{ titre: "Filles", largeur: 22, align: "right" },
				{ titre: "Total", largeur: 22, align: "right" },
				{ titre: "Capacité", largeur: 22, align: "right" },
				{ titre: "Remplissage", largeur: 25, align: "right" },
			],
			r.effectifs.map((e) => [
				e.niveau,
				e.classe,
				String(e.garcons),
				String(e.filles),
				String(e.total),
				String(e.capacite),
				pct(e.total, e.capacite),
			]),
			[
				"Total",
				"",
				String(somme("garcons")),
				String(somme("filles")),
				String(somme("total")),
				String(somme("capacite")),
				pct(somme("total"), somme("capacite")),
			],
		);
	}

	// 2. Finances
	const t = r.bilan.totaux;
	y = titreSection(doc, y, "2. Finances de l'année");
	y = tableau(
		doc,
		y,
		[
			{ titre: "Poste", largeur: 0 },
			{ titre: "Montant", largeur: 45, align: "right" },
		],
		[
			["Encaissements élèves", cfa(t.totalPaiements)],
			["Recettes diverses", cfa(t.totalRecettes)],
			["Dépenses", `- ${cfa(t.totalDepenses)}`],
			["Salaires payés", `- ${cfa(t.totalSalaires)}`],
		],
		["Résultat", cfa(t.solde)],
	);
	if (r.bilan.lignes.length)
		y = tableau(
			doc,
			y,
			[
				{ titre: "Mois", largeur: 0 },
				{ titre: "Encaissements", largeur: 30, align: "right" },
				{ titre: "Recettes", largeur: 26, align: "right" },
				{ titre: "Dépenses", largeur: 26, align: "right" },
				{ titre: "Salaires", largeur: 28, align: "right" },
				{ titre: "Solde", largeur: 28, align: "right" },
			],
			r.bilan.lignes.map((l) => [
				`${MOIS_LABELS[l.mois]} ${l.annee}`,
				cfa(l.paiements),
				cfa(l.recettes),
				cfa(l.depenses),
				cfa(l.salaires),
				cfa(l.solde),
			]),
		);

	// 3. Impayés et réductions
	const imp = r.impayes;
	y = titreSection(doc, y, "3. Impayés et réductions");
	y = paragraphe(
		doc,
		y,
		`Dû : ${cfa(imp.totalDu)} · Payé : ${cfa(imp.totalPaye)} · Reste à payer : ${cfa(imp.totalReste)}`,
	);
	if (!imp.parClasse.length) y = paragraphe(doc, y, "Aucun impayé à ce jour.");
	else {
		y = tableau(
			doc,
			y,
			[
				{ titre: "Classe", largeur: 0 },
				{ titre: "Élèves concernés", largeur: 35, align: "right" },
				{ titre: "Reste", largeur: 40, align: "right" },
			],
			imp.parClasse.map((c) => [c.classe, String(c.eleves), cfa(c.reste)]),
			["Total", String(imp.parClasse.reduce((s, c) => s + c.eleves, 0)), cfa(imp.totalReste)],
		);
		y = tableau(
			doc,
			y,
			[
				{ titre: "Plus gros restes", largeur: 0 },
				{ titre: "Classe", largeur: 40 },
				{ titre: "Reste", largeur: 40, align: "right" },
			],
			imp.top.map((e) => [e.eleve, e.classe, cfa(e.reste)]),
		);
	}
	const nbReductions = r.reductions.parType.reduce((s, p) => s + p.nombre, 0);
	if (!nbReductions) y = paragraphe(doc, y, "Aucune réduction accordée.");
	else
		y = tableau(
			doc,
			y,
			[
				{ titre: "Réductions", largeur: 0 },
				{ titre: "Élèves", largeur: 30, align: "right" },
			],
			r.reductions.parType.map((p) => [
				LIBELLES_TYPE_REDUCTION[p.type as Reduction["type"]] ?? p.type,
				String(p.nombre),
			]),
			[`Montant accordé sur l'année : ${cfa(r.reductions.montantTotal)}`, String(nbReductions)],
		);

	// 4. Personnel et transport
	y = titreSection(doc, y, "4. Personnel et transport");
	const nbEmployes = r.personnel.parType.reduce((s, p) => s + p.nombre, 0);
	if (!nbEmployes) y = paragraphe(doc, y, "Aucun employé actif.");
	else
		y = tableau(
			doc,
			y,
			[
				{ titre: "Personnel actif", largeur: 0 },
				{ titre: "Effectif", largeur: 30, align: "right" },
			],
			r.personnel.parType.map((p) => [majuscule(p.type), String(p.nombre)]),
			["Total", String(nbEmployes)],
		);
	y = paragraphe(
		doc,
		y,
		`Masse salariale mensuelle : ${cfa(r.personnel.masseMensuelle)} · Salaires payés sur l'année : ${cfa(r.personnel.salairesPayes)}`,
	);
	if (!r.transport.vehicules.length) y = paragraphe(doc, y, "Aucun véhicule enregistré.");
	else
		y = tableau(
			doc,
			y,
			[
				{ titre: "Véhicule", largeur: 0 },
				{ titre: "Capacité", largeur: 30, align: "right" },
			],
			r.transport.vehicules.map((v) => [v.immatriculation, String(v.capacite)]),
		);
	paragraphe(
		doc,
		y,
		`Itinéraires : ${r.transport.itineraires} · Élèves transportés : ${r.transport.eleves}`,
	);

	paginer(
		doc,
		`${ecole.nom} — Rapport de l'établissement ${r.annee.libelle} — édité le ${new Date().toLocaleDateString("fr-FR")}`,
	);
	return doc;
}

export function telechargerRapportEtablissement(r: RapportEtablissement, ecole: Parametres) {
	buildRapportEtablissementPdf(r, ecole).save(`rapport-etablissement-${r.annee.libelle}.pdf`);
}
