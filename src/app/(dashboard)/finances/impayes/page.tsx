"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { libelleMoisImpayes } from "@/modules/finance/impayes";
import { downloadRelancesPdf } from "@/shared/lib/generate-relance-pdf";
import { trpc } from "@/shared/lib/trpc-client";
import { formatCFA } from "@/shared/lib/utils";
import { Button, PageHeader } from "@/shared/ui";

const SELECT =
	"rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function ImpayesPage() {
	const annees = trpc.academic.annees.list.useQuery();
	const annee = annees.data?.find((a) => a.active);
	const niveaux = trpc.academic.niveaux.list.useQuery();
	const classes = trpc.academic.classes.list.useQuery(
		{ anneeScolaireId: annee?.id ?? "" },
		{ enabled: !!annee },
	);
	const parametres = trpc.settings.get.useQuery();

	const [niveauId, setNiveauId] = useState("");
	const [classeId, setClasseId] = useState("");
	const [selection, setSelection] = useState<Set<string>>(new Set());

	const impayes = trpc.finance.impayes.list.useQuery(
		{
			anneeScolaireId: annee?.id ?? "",
			niveauId: niveauId || undefined,
			classeId: classeId || undefined,
		},
		{ enabled: !!annee },
	);
	const lignes = impayes.data?.lignes ?? [];
	const classesFiltrees = (classes.data ?? []).filter((c) => !niveauId || c.niveauId === niveauId);
	const selectionnees = useMemo(
		() => lignes.filter((l) => selection.has(l.id)),
		[lignes, selection],
	);

	function basculer(id: string) {
		const s = new Set(selection);
		if (s.has(id)) s.delete(id);
		else s.add(id);
		setSelection(s);
	}

	function lettres(ls: typeof lignes) {
		if (parametres.data && ls.length > 0) downloadRelancesPdf(ls, parametres.data);
	}

	const defauts = impayes.data?.classesMontantDefaut ?? [];

	return (
		<div>
			<PageHeader
				title="Impayés"
				breadcrumbs={[{ label: "Finances", href: "/finances/paiements" }, { label: "Impayés" }]}
			/>

			{defauts.length > 0 && (
				<div className="mb-4 rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-800">
					{defauts.length} classe{defauts.length > 1 ? "s utilisent" : " utilise"} le montant par
					défaut ({defauts.map((d) => `${d.classeNom} : ${d.frais.join(", ")}`).join(" ; ")}).{" "}
					<Link href="/finances/grille" className="font-medium underline">
						Compléter la grille tarifaire
					</Link>
				</div>
			)}

			<div className="mb-4 flex flex-wrap items-end gap-3">
				<div>
					<label htmlFor="filtre-niveau" className="mb-1 block text-sm font-medium">
						Niveau
					</label>
					<select
						id="filtre-niveau"
						value={niveauId}
						className={SELECT}
						onChange={(e) => {
							setNiveauId(e.target.value);
							setClasseId("");
							setSelection(new Set());
						}}
					>
						<option value="">Tous les niveaux</option>
						{niveaux.data?.map((n) => (
							<option key={n.id} value={n.id}>
								{n.nom}
							</option>
						))}
					</select>
				</div>
				<div>
					<label htmlFor="filtre-classe" className="mb-1 block text-sm font-medium">
						Classe
					</label>
					<select
						id="filtre-classe"
						value={classeId}
						className={SELECT}
						onChange={(e) => {
							setClasseId(e.target.value);
							setSelection(new Set());
						}}
					>
						<option value="">Toutes les classes</option>
						{classesFiltrees.map((c) => (
							<option key={c.id} value={c.id}>
								{c.nom}
							</option>
						))}
					</select>
				</div>
				<Button
					className="ml-auto"
					disabled={selectionnees.length === 0 || !parametres.data}
					onClick={() => lettres(selectionnees)}
				>
					Lettres de relance ({selectionnees.length})
				</Button>
			</div>

			<div className="overflow-x-auto rounded-xl bg-surface shadow-sm">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b text-left text-xs uppercase text-muted">
							<th className="px-3 py-2">
								<input
									type="checkbox"
									aria-label="Tout sélectionner"
									checked={lignes.length > 0 && selection.size === lignes.length}
									onChange={(e) =>
										setSelection(e.target.checked ? new Set(lignes.map((l) => l.id)) : new Set())
									}
								/>
							</th>
							<th className="px-3 py-2">Matricule</th>
							<th className="px-3 py-2">Élève</th>
							<th className="px-3 py-2">Classe</th>
							<th className="px-3 py-2 text-right">Dû</th>
							<th className="px-3 py-2 text-right">Payé</th>
							<th className="px-3 py-2 text-right">Reste</th>
							<th className="px-3 py-2">Mois impayés</th>
							<th className="px-3 py-2">Téléphone</th>
							<th className="px-3 py-2" />
						</tr>
					</thead>
					<tbody>
						{impayes.isLoading && (
							<tr>
								<td colSpan={10} className="px-3 py-6 text-center text-muted">
									Chargement...
								</td>
							</tr>
						)}
						{!impayes.isLoading && lignes.length === 0 && (
							<tr>
								<td colSpan={10} className="px-3 py-6 text-center text-muted">
									Aucun impayé.
								</td>
							</tr>
						)}
						{lignes.map((l) => (
							<tr key={l.id} className="border-b last:border-0">
								<td className="px-3 py-2">
									<input
										type="checkbox"
										aria-label={`Sélectionner ${l.prenom} ${l.nom}`}
										checked={selection.has(l.id)}
										onChange={() => basculer(l.id)}
									/>
								</td>
								<td className="whitespace-nowrap px-3 py-2">{l.matricule}</td>
								<td className="px-3 py-2">
									<Link href={`/eleves/${l.id}`} className="hover:underline">
										{l.prenom} {l.nom}
									</Link>
								</td>
								<td className="px-3 py-2">{l.classeNom}</td>
								<td className="whitespace-nowrap px-3 py-2 text-right">{formatCFA(l.du)}</td>
								<td className="whitespace-nowrap px-3 py-2 text-right">{formatCFA(l.paye)}</td>
								<td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-red-600">
									{formatCFA(l.reste)}
								</td>
								<td className="min-w-48 px-3 py-2 text-xs">{libelleMoisImpayes(l.moisImpayes)}</td>
								<td className="whitespace-nowrap px-3 py-2">{l.telephone ?? "—"}</td>
								<td className="px-3 py-2">
									<Button
										variant="ghost"
										size="sm"
										disabled={!parametres.data}
										onClick={() => lettres([l])}
									>
										Lettre
									</Button>
								</td>
							</tr>
						))}
					</tbody>
					{lignes.length > 0 && impayes.data && (
						<tfoot>
							<tr className="border-t-2 font-semibold">
								<td colSpan={4} className="px-3 py-2">
									Total ({lignes.length} élève{lignes.length > 1 ? "s" : ""})
								</td>
								<td className="px-3 py-2 text-right">{formatCFA(impayes.data.totalDu)}</td>
								<td className="px-3 py-2 text-right">{formatCFA(impayes.data.totalPaye)}</td>
								<td className="px-3 py-2 text-right text-red-600">
									{formatCFA(impayes.data.totalReste)}
								</td>
								<td colSpan={3} />
							</tr>
						</tfoot>
					)}
				</table>
			</div>
			<p className="mt-3 text-xs text-muted">
				Un mois pour lequel un paiement est enregistré est considéré comme soldé, quel que soit le
				montant (remises). « Payé » inclut les avances ; c'est pourquoi Dû − Payé peut différer du
				Reste.
			</p>
		</div>
	);
}
