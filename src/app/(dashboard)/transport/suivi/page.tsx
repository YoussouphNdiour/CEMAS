"use client";

import { CircleDot } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { cn, formatCFA, MOIS_LABELS } from "@/shared/lib/utils";
import { PageHeader } from "@/shared/ui";

const SCHOOL_MONTHS = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7];

export default function SuiviTransportPage() {
	const annees = trpc.academic.annees.list.useQuery();
	const activeAnnee = annees.data?.find((a) => a.active);

	const { data: itinerairesList = [] } = trpc.transport.itineraires.list.useQuery();

	const [selectedItineraire, setSelectedItineraire] = useState("");

	const suivi = trpc.transport.suivi.byItineraire.useQuery(
		{ itineraireId: selectedItineraire, anneeScolaireId: activeAnnee?.id ?? "" },
		{ enabled: !!selectedItineraire && !!activeAnnee?.id },
	);

	const data = suivi.data;
	const students = data?.students ?? [];

	const totalPaid = students.reduce((sum, s) => sum + s.paidCount, 0);
	const totalExpected = students.length * SCHOOL_MONTHS.length;

	const selectedIt = itinerairesList.find((i) => i.id === selectedItineraire);

	return (
		<div>
			<PageHeader
				title="Suivi Transport"
				breadcrumbs={[{ label: "Transport", href: "/transport/vehicules" }, { label: "Suivi" }]}
			/>

			<div className="mb-6 flex items-center gap-4">
				<select
					value={selectedItineraire}
					onChange={(e) => setSelectedItineraire(e.target.value)}
					className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				>
					<option value="">Sélectionner un itinéraire</option>
					{itinerairesList.map((it) => (
						<option key={it.id} value={it.id}>
							{it.nom}
						</option>
					))}
				</select>
				{activeAnnee && (
					<span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
						{activeAnnee.libelle}
					</span>
				)}
				{selectedIt && selectedIt.montantMensuel > 0 && (
					<span className="rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
						{formatCFA(selectedIt.montantMensuel)}/mois
					</span>
				)}
			</div>

			{!selectedItineraire && (
				<div className="rounded-xl bg-surface p-12 text-center shadow-sm">
					<p className="text-muted">
						Sélectionnez un itinéraire pour voir le suivi des paiements transport.
					</p>
				</div>
			)}

			{selectedItineraire && students.length === 0 && !suivi.isLoading && (
				<div className="rounded-xl bg-surface p-12 text-center shadow-sm">
					<p className="text-muted">Aucun élève affecté à cet itinéraire.</p>
				</div>
			)}

			{selectedItineraire && students.length > 0 && (
				<div className="overflow-hidden rounded-xl bg-surface shadow-sm">
					<div className="flex items-center justify-between bg-gray-50 px-4 py-2.5">
						<span className="text-sm font-semibold">Paiements transport — {selectedIt?.nom}</span>
						<span className="text-sm text-muted">
							{totalPaid}/{totalExpected} paiements reçus
						</span>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm">
							<thead>
								<tr className="border-b">
									<th className="sticky left-0 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
										Élève
									</th>
									<th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted">
										Arrêt
									</th>
									{SCHOOL_MONTHS.map((m) => (
										<th
											key={m}
											className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted"
										>
											{MOIS_LABELS[m]?.slice(0, 3)}
										</th>
									))}
									<th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted">
										Total
									</th>
								</tr>
							</thead>
							<tbody>
								{students.map((student) => (
									<tr key={student.id} className="border-b last:border-b-0">
										<td className="sticky left-0 bg-white px-4 py-2 font-medium whitespace-nowrap">
											{student.prenom} {student.nom}
										</td>
										<td className="px-3 py-2 text-center text-xs text-muted whitespace-nowrap">
											{student.arretNom}
										</td>
										{student.months.map((monthData) => (
											<td key={monthData.mois} className="px-2 py-2 text-center">
												{monthData.paid ? (
													<CircleDot className="mx-auto h-5 w-5 text-green-500" />
												) : (
													<CircleDot className="mx-auto h-5 w-5 text-gray-200" />
												)}
											</td>
										))}
										<td className="px-3 py-2 text-center">
											<span
												className={cn(
													"inline-block min-w-[2rem] rounded-full px-2 py-0.5 text-xs font-semibold",
													student.paidCount === 10
														? "bg-green-100 text-green-700"
														: student.paidCount > 0
															? "bg-yellow-100 text-yellow-700"
															: "bg-red-50 text-red-500",
												)}
											>
												{student.paidCount}/10
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
}
