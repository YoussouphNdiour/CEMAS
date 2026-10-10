"use client";

import Link from "next/link";
import { LIBELLES_TYPE_REDUCTION, type Reduction } from "@/modules/finance/reductions";
import { trpc } from "@/shared/lib/trpc-client";
import { formatCFA } from "@/shared/lib/utils";
import { PageHeader } from "@/shared/ui";

const PORTEES: Record<Reduction["portee"], string> = {
	forfait: "Forfait",
	mensualites: "Mensualités",
	les_deux: "Forfait et mensualités",
};

export default function ReductionsPage() {
	const annees = trpc.academic.annees.list.useQuery();
	const annee = annees.data?.find((a) => a.active);
	const liste = trpc.finance.reductions.list.useQuery(
		{ anneeScolaireId: annee?.id ?? "" },
		{ enabled: !!annee },
	);
	const lignes = liste.data ?? [];
	const total = lignes.reduce((t, l) => t + l.montantAnnuel, 0);

	return (
		<div>
			<PageHeader
				title="Réductions"
				breadcrumbs={[{ label: "Finances", href: "/finances/paiements" }, { label: "Réductions" }]}
			/>
			<p className="mb-4 text-sm text-muted">
				Réductions accordées pour l'année {annee?.libelle ?? ""}. Elles se saisissent depuis la
				fiche de l'élève et sont prises en compte dans les impayés, les relances et les montants
				proposés.
			</p>
			<div className="overflow-x-auto rounded-xl bg-surface shadow-sm">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b text-left text-xs uppercase text-muted">
							<th className="px-3 py-2">Élève</th>
							<th className="px-3 py-2">Classe</th>
							<th className="px-3 py-2">Type</th>
							<th className="px-3 py-2">Porte sur</th>
							<th className="px-3 py-2 text-right">Valeur</th>
							<th className="px-3 py-2">Motif</th>
							<th className="px-3 py-2 text-right">Accordé sur l'année</th>
						</tr>
					</thead>
					<tbody>
						{liste.isLoading && (
							<tr>
								<td colSpan={7} className="px-3 py-6 text-center text-muted">
									Chargement...
								</td>
							</tr>
						)}
						{liste.isSuccess && lignes.length === 0 && (
							<tr>
								<td colSpan={7} className="px-3 py-6 text-center text-muted">
									Aucune réduction.
								</td>
							</tr>
						)}
						{lignes.map((l) => (
							<tr key={l.eleveId} className="border-b last:border-0">
								<td className="px-3 py-2">
									<Link href={`/eleves/${l.eleveId}`} className="hover:underline">
										{l.prenom} {l.nom}
									</Link>
									<div className="text-xs text-muted">{l.matricule}</div>
								</td>
								<td className="px-3 py-2">{l.classeNom}</td>
								<td className="px-3 py-2">
									{LIBELLES_TYPE_REDUCTION[l.type as Reduction["type"]]}
								</td>
								<td className="px-3 py-2">{PORTEES[l.portee as Reduction["portee"]]}</td>
								<td className="whitespace-nowrap px-3 py-2 text-right">
									{l.mode === "pourcentage" ? `${l.valeur} %` : formatCFA(l.valeur)}
								</td>
								<td className="px-3 py-2 text-muted">{l.motif ?? "—"}</td>
								<td className="whitespace-nowrap px-3 py-2 text-right font-medium">
									{formatCFA(l.montantAnnuel)}
								</td>
							</tr>
						))}
					</tbody>
					{lignes.length > 0 && (
						<tfoot>
							<tr className="border-t-2 font-semibold">
								<td colSpan={6} className="px-3 py-2">
									Total ({lignes.length} élève{lignes.length > 1 ? "s" : ""})
								</td>
								<td className="px-3 py-2 text-right">{formatCFA(total)}</td>
							</tr>
						</tfoot>
					)}
				</table>
			</div>
		</div>
	);
}
