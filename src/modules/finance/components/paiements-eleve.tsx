"use client";

import { trpc } from "@/shared/lib/trpc-client";
import { formatCFA, formatDate, MOIS_LABELS } from "@/shared/lib/utils";
import { ActionsPaiement } from "./actions-paiement";

/** Paiements de l'élève sur son année, avec les actions de l'administrateur. */
export function PaiementsEleve({
	eleveId,
	anneeScolaireId,
	libelleEleve,
	estAdmin,
}: {
	eleveId: string;
	anneeScolaireId: string;
	libelleEleve: string;
	estAdmin: boolean;
}) {
	const liste = trpc.finance.paiements.listByEleve.useQuery({ eleveId, anneeScolaireId });
	const types = trpc.finance.typesFrais.list.useQuery();
	const nomType = (id: string) => types.data?.find((t) => t.id === id)?.nom ?? "";
	const paiements = liste.data ?? [];
	const total = paiements.reduce((t, p) => t + p.montant, 0);

	return (
		<section aria-label="Paiements" className="rounded-xl bg-surface p-6 shadow-sm">
			<h2 className="mb-4 text-lg font-semibold">Paiements</h2>
			{liste.isLoading && <p className="text-sm text-muted">Chargement...</p>}
			{!liste.isLoading && paiements.length === 0 && (
				<p className="text-sm text-muted">Aucun paiement cette année.</p>
			)}
			{paiements.length > 0 && (
				<table className="w-full text-left text-sm">
					<thead>
						<tr className="border-b text-xs uppercase text-muted">
							<th className="py-2 pr-2">Reçu</th>
							<th className="py-2 pr-2">Type</th>
							<th className="py-2 pr-2">Mois</th>
							<th className="py-2 pr-2 text-right">Montant</th>
							<th className="py-2 pr-2">Date</th>
							{estAdmin && <th className="py-2" />}
						</tr>
					</thead>
					<tbody>
						{paiements.map((p) => (
							<tr key={p.id} className="border-b last:border-0">
								<td className="py-2 pr-2">{p.numeroRecu}</td>
								<td className="py-2 pr-2">{nomType(p.typeFraisId)}</td>
								<td className="py-2 pr-2">{MOIS_LABELS[p.mois]}</td>
								<td className="py-2 pr-2 text-right">{formatCFA(p.montant)}</td>
								<td className="py-2 pr-2">{formatDate(p.datePaiement)}</td>
								{estAdmin && (
									<td className="py-2">
										<ActionsPaiement
											paiement={{
												id: p.id,
												numeroRecu: p.numeroRecu,
												typeFraisId: p.typeFraisId,
												mois: p.mois,
												montant: p.montant,
												datePaiement: p.datePaiement,
												libelleEleve,
											}}
										/>
									</td>
								)}
							</tr>
						))}
					</tbody>
					<tfoot>
						<tr className="font-semibold">
							<td className="py-2" colSpan={3}>
								Total
							</td>
							<td className="py-2 pr-2 text-right">{formatCFA(total)}</td>
							<td colSpan={estAdmin ? 2 : 1} />
						</tr>
					</tfoot>
				</table>
			)}
		</section>
	);
}
