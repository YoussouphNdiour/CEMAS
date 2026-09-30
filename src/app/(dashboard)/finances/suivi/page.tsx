"use client";

import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { PageHeader } from "@/shared/ui";
import { MOIS_LABELS, cn } from "@/shared/lib/utils";

const SCHOOL_MONTHS = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7];

export default function SuiviPage() {
	const annees = trpc.academic.annees.list.useQuery();
	const activeAnnee = annees.data?.find((a) => a.active);

	const classesList = trpc.academic.classes.list.useQuery(
		{ anneeScolaireId: activeAnnee?.id ?? "" },
		{ enabled: !!activeAnnee?.id },
	);

	const [selectedClasse, setSelectedClasse] = useState("");

	const suivi = trpc.finance.suivi.byClasse.useQuery(
		{ classeId: selectedClasse, anneeScolaireId: activeAnnee?.id ?? "" },
		{ enabled: !!selectedClasse && !!activeAnnee?.id },
	);

	return (
		<div>
			<PageHeader
				title="Suivi des paiements"
				breadcrumbs={[
					{ label: "Finances", href: "/finances/paiements" },
					{ label: "Suivi" },
				]}
			/>

			<div className="mb-6 flex items-center gap-4">
				<select
					value={selectedClasse}
					onChange={(e) => setSelectedClasse(e.target.value)}
					className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				>
					<option value="">Sélectionner une classe</option>
					{classesList.data?.map((c) => (
						<option key={c.id} value={c.id}>
							{c.nom}
						</option>
					))}
				</select>
				{activeAnnee && (
					<span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
						{activeAnnee.libelle}
					</span>
				)}
			</div>

			{!selectedClasse && (
				<div className="rounded-xl bg-surface p-12 text-center shadow-sm">
					<p className="text-muted">
						Sélectionnez une classe pour voir le suivi des paiements.
					</p>
				</div>
			)}

			{selectedClasse && suivi.data && suivi.data.length > 0 && (
				<div className="rounded-xl border bg-surface shadow-sm overflow-x-auto">
					{suivi.data[0].typesFrais.map((tf) => (
						<div key={tf.typeFraisId} className="border-b last:border-b-0">
							<div className="bg-gray-50 px-4 py-2 text-sm font-semibold">
								{tf.typeFraisNom}
							</div>
							<table className="w-full text-left text-sm">
								<thead>
									<tr className="border-b">
										<th className="sticky left-0 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
											Élève
										</th>
										{SCHOOL_MONTHS.map((m) => (
											<th
												key={m}
												className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted"
											>
												{MOIS_LABELS[m]?.slice(0, 3)}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{suivi.data!.map((student) => {
										const frais = student.typesFrais.find(
											(f) => f.typeFraisId === tf.typeFraisId,
										);
										return (
											<tr key={student.id} className="border-b last:border-b-0">
												<td className="sticky left-0 bg-white px-4 py-2 font-medium whitespace-nowrap">
													{student.prenom} {student.nom}
												</td>
												{frais?.months.map((monthData) => (
													<td
														key={monthData.mois}
														className="px-2 py-2 text-center"
													>
														<div
															className={cn(
																"mx-auto h-6 w-6 rounded-full",
																monthData.paid
																	? "bg-green-400"
																	: "bg-red-300",
															)}
															title={
																monthData.paid
																	? "Payé"
																	: "Non payé"
															}
														/>
													</td>
												))}
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					))}
				</div>
			)}

			{selectedClasse && suivi.data && suivi.data.length === 0 && (
				<div className="rounded-xl bg-surface p-12 text-center shadow-sm">
					<p className="text-muted">Aucun élève dans cette classe.</p>
				</div>
			)}
		</div>
	);
}
