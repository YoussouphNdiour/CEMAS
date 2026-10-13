"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { bornesPeriode, type TypePeriode } from "@/modules/reports/periode";
import { telechargerRapportComptable } from "@/shared/lib/generate-rapport-comptable-pdf";
import { telechargerRapportEtablissement } from "@/shared/lib/generate-rapport-etablissement-pdf";
import { trpc } from "@/shared/lib/trpc-client";
import { Button, PageHeader } from "@/shared/ui";

const CHAMP =
	"w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const aujourdhui = () => {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function RapportsPage() {
	const utils = trpc.useUtils();
	const annees = trpc.academic.annees.list.useQuery();
	const parametres = trpc.settings.get.useQuery();
	const active = annees.data?.find((a) => a.active);

	const [periode, setPeriode] = useState<TypePeriode>("mois");
	const [date, setDate] = useState(aujourdhui());
	const [mois, setMois] = useState(aujourdhui().slice(0, 7));
	const [anneeCompta, setAnneeCompta] = useState("");
	const [anneeEtab, setAnneeEtab] = useState("");
	const [enCours, setEnCours] = useState<"compta" | "etab" | null>(null);
	const [erreur, setErreur] = useState<string | null>(null);

	const anneeId = (choix: string) => choix || active?.id || "";

	async function rapportComptable() {
		if (!parametres.data) return;
		setErreur(null);
		setEnCours("compta");
		try {
			let bornes: { du: string; au: string; libelle: string };
			if (periode === "annee") {
				const a = annees.data?.find((x) => x.id === anneeId(anneeCompta));
				if (!a) throw new Error("Choisissez une année scolaire.");
				bornes = {
					du: a.dateDebut,
					au: a.dateFin,
					libelle: `Année scolaire ${a.libelle} (opérations rattachées à l'année)`,
				};
			} else {
				bornes = bornesPeriode(periode, periode === "mois" ? `${mois}-01` : date);
			}
			const data = await utils.reports.comptabilite.fetch({
				du: bornes.du,
				au: bornes.au,
				anneeScolaireId: periode === "annee" ? anneeId(anneeCompta) : undefined,
			});
			telechargerRapportComptable(data, bornes.libelle, parametres.data);
		} catch (e) {
			setErreur(e instanceof Error ? e.message : "Erreur lors de la génération du rapport.");
		} finally {
			setEnCours(null);
		}
	}

	async function rapportEtablissement() {
		if (!parametres.data) return;
		setErreur(null);
		setEnCours("etab");
		try {
			const data = await utils.reports.etablissement.fetch({ anneeScolaireId: anneeId(anneeEtab) });
			telechargerRapportEtablissement(data, parametres.data);
		} catch (e) {
			setErreur(e instanceof Error ? e.message : "Erreur lors de la génération du rapport.");
		} finally {
			setEnCours(null);
		}
	}

	const choixAnnee = (valeur: string, changer: (v: string) => void, id: string) => (
		<select
			id={id}
			className={CHAMP}
			value={anneeId(valeur)}
			onChange={(e) => changer(e.target.value)}
		>
			{annees.data?.map((a) => (
				<option key={a.id} value={a.id}>
					{a.libelle}
					{a.active ? " (active)" : ""}
				</option>
			))}
		</select>
	);

	return (
		<div>
			<PageHeader title="Rapports" breadcrumbs={[{ label: "Rapports" }]} />
			{erreur && (
				<p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-danger">
					{erreur}
				</p>
			)}
			<div className="grid gap-6 lg:grid-cols-2">
				<section aria-label="Comptabilité" className="rounded-xl bg-surface p-6 shadow-sm">
					<h2 className="mb-1 text-lg font-semibold">Comptabilité</h2>
					<p className="mb-4 text-sm text-muted">
						Encaissements, recettes, dépenses et salaires de la période, avec le détail de chaque
						opération.
					</p>
					<div className="space-y-3">
						<div>
							<label htmlFor="rapport-periode" className="mb-1 block text-sm font-medium">
								Période
							</label>
							<select
								id="rapport-periode"
								className={CHAMP}
								value={periode}
								onChange={(e) => setPeriode(e.target.value as TypePeriode)}
							>
								<option value="jour">Jour</option>
								<option value="semaine">Semaine (lundi au dimanche)</option>
								<option value="mois">Mois</option>
								<option value="annee">Année scolaire</option>
							</select>
						</div>
						{(periode === "jour" || periode === "semaine") && (
							<div>
								<label htmlFor="rapport-date" className="mb-1 block text-sm font-medium">
									{periode === "jour" ? "Date" : "Une date de la semaine"}
								</label>
								<input
									id="rapport-date"
									type="date"
									className={CHAMP}
									value={date}
									onChange={(e) => setDate(e.target.value)}
								/>
								{periode === "semaine" && date && (
									<p className="mt-1 text-xs text-muted">
										{bornesPeriode("semaine", date).libelle}
									</p>
								)}
							</div>
						)}
						{periode === "mois" && (
							<div>
								<label htmlFor="rapport-mois" className="mb-1 block text-sm font-medium">
									Mois
								</label>
								<input
									id="rapport-mois"
									type="month"
									className={CHAMP}
									value={mois}
									onChange={(e) => setMois(e.target.value)}
								/>
							</div>
						)}
						{periode === "annee" && (
							<div>
								<label htmlFor="rapport-annee-compta" className="mb-1 block text-sm font-medium">
									Année scolaire
								</label>
								{choixAnnee(anneeCompta, setAnneeCompta, "rapport-annee-compta")}
							</div>
						)}
						<Button
							onClick={rapportComptable}
							disabled={
								enCours !== null ||
								!parametres.data ||
								((periode === "jour" || periode === "semaine") && !date) ||
								(periode === "mois" && !mois)
							}
						>
							<Download className="h-4 w-4" />
							{enCours === "compta" ? "Génération..." : "Télécharger le PDF"}
						</Button>
					</div>
				</section>

				<section
					aria-label="Rapport de l'établissement"
					className="rounded-xl bg-surface p-6 shadow-sm"
				>
					<h2 className="mb-1 text-lg font-semibold">Rapport de l'établissement</h2>
					<p className="mb-4 text-sm text-muted">
						Effectifs, finances de l'année, impayés et réductions, personnel et transport.
					</p>
					<div className="space-y-3">
						<div>
							<label htmlFor="rapport-annee-etab" className="mb-1 block text-sm font-medium">
								Année scolaire
							</label>
							{choixAnnee(anneeEtab, setAnneeEtab, "rapport-annee-etab")}
						</div>
						<Button
							onClick={rapportEtablissement}
							disabled={enCours !== null || !parametres.data || !anneeId(anneeEtab)}
						>
							<Download className="h-4 w-4" />
							{enCours === "etab" ? "Génération..." : "Télécharger le PDF"}
						</Button>
					</div>
				</section>
			</div>
		</div>
	);
}
