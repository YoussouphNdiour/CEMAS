"use client";

import { CheckCircle2, CircleDot, XCircle } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { cn, formatCFA, MOIS_LABELS } from "@/shared/lib/utils";
import { PageHeader } from "@/shared/ui";

const SCHOOL_MONTHS = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7];

/** Tarif du niveau de la classe : montant unique ou fourchette (échéancier variable). */
function montantEnTete(tf: { montantMin: number; montantMax: number }) {
	return tf.montantMin === tf.montantMax
		? formatCFA(tf.montantMin)
		: `${formatCFA(tf.montantMin)} – ${formatCFA(tf.montantMax)}`;
}

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

	const students = suivi.data ?? [];

	// Separate fee types
	const allFraisTypes = students[0]?.typesFrais ?? [];
	const fraisUniques = allFraisTypes.filter((tf) => !tf.mensuel);
	const fraisMensuels = allFraisTypes.filter((tf) => tf.mensuel);

	// Stats for unique fees
	const computeUniqueStats = (typeFraisId: string) => {
		let paid = 0;
		let unpaid = 0;
		for (const s of students) {
			const tf = s.typesFrais.find((f) => f.typeFraisId === typeFraisId);
			if (tf?.paid) paid++;
			else unpaid++;
		}
		return { paid, unpaid, total: paid + unpaid };
	};

	// Stats for monthly fees
	const computeMonthlyStats = () => {
		let totalPaid = 0;
		let totalExpected = 0;
		for (const s of students) {
			for (const tf of s.typesFrais) {
				if (!tf.mensuel) continue;
				for (const m of tf.months) {
					// Octobre inclus dans le forfait et mois hors échéancier : non comptés
					if (m.statut === "inclus" || m.statut === "non_du") continue;
					totalExpected++;
					if (m.paid) totalPaid++;
				}
			}
		}
		return { totalPaid, totalExpected };
	};

	const monthlyStats = students.length > 0 ? computeMonthlyStats() : null;

	return (
		<div>
			<PageHeader
				title="Suivi des paiements"
				breadcrumbs={[{ label: "Finances", href: "/finances/paiements" }, { label: "Suivi" }]}
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
					<p className="text-muted">Sélectionnez une classe pour voir le suivi des paiements.</p>
				</div>
			)}

			{selectedClasse && students.length === 0 && !suivi.isLoading && (
				<div className="rounded-xl bg-surface p-12 text-center shadow-sm">
					<p className="text-muted">Aucun élève dans cette classe.</p>
				</div>
			)}

			{selectedClasse && students.length > 0 && (
				<div className="space-y-6">
					{/* ── Frais uniques (Inscription, Tenue) ── */}
					{fraisUniques.length > 0 && (
						<div>
							<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
								Frais uniques
							</h2>
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{fraisUniques.map((tf) => {
									const stats = computeUniqueStats(tf.typeFraisId);
									const pct = stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0;
									return (
										<div key={tf.typeFraisId} className="rounded-xl bg-surface p-5 shadow-sm">
											<div className="mb-3 flex items-center justify-between">
												<h3 className="font-semibold">{tf.typeFraisNom}</h3>
												<span className="text-sm text-muted">{montantEnTete(tf)}</span>
											</div>
											{/* Progress bar */}
											<div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
												<div
													className={cn(
														"h-full rounded-full transition-all",
														pct === 100
															? "bg-green-500"
															: pct > 50
																? "bg-yellow-400"
																: "bg-red-400",
													)}
													style={{ width: `${pct}%` }}
												/>
											</div>
											<div className="mb-4 flex items-center justify-between text-sm">
												<span className="text-muted">
													{stats.paid}/{stats.total} payés
												</span>
												<span className="font-semibold">{pct}%</span>
											</div>
											{/* Student list */}
											<div className="space-y-1.5">
												{students.map((s) => {
													const f = s.typesFrais.find((x) => x.typeFraisId === tf.typeFraisId);
													const isPaid = f?.paid ?? false;
													return (
														<div
															key={s.id}
															className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm"
														>
															<span>
																{s.prenom} {s.nom}
															</span>
															{isPaid ? (
																<CheckCircle2 className="h-4 w-4 text-green-500" />
															) : (
																<XCircle className="h-4 w-4 text-red-400" />
															)}
														</div>
													);
												})}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					)}

					{/* ── Frais mensuels (Scolarité) ── */}
					{fraisMensuels.length > 0 && (
						<div>
							<div className="mb-3 flex items-center justify-between">
								<h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
									Frais mensuels
								</h2>
								{monthlyStats && (
									<span className="text-sm text-muted">
										{monthlyStats.totalPaid}/{monthlyStats.totalExpected} paiements reçus
									</span>
								)}
							</div>

							{fraisMensuels.map((tf) => (
								<div
									key={tf.typeFraisId}
									className="mb-4 overflow-hidden rounded-xl bg-surface shadow-sm"
								>
									<div className="flex items-center justify-between bg-gray-50 px-4 py-2.5">
										<span className="text-sm font-semibold">{tf.typeFraisNom}</span>
										<span className="text-xs text-muted">{montantEnTete(tf)}/mois</span>
									</div>
									<div className="overflow-x-auto">
										<table className="w-full text-left text-sm">
											<thead>
												<tr className="border-b">
													<th className="sticky left-0 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
														Élève
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
												{students.map((student) => {
													const frais = student.typesFrais.find(
														(f) => f.typeFraisId === tf.typeFraisId,
													);
													const paidCount = frais?.months.filter((m) => m.paid).length ?? 0;
													const dueCount =
														frais?.months.filter(
															(m) => m.statut !== "inclus" && m.statut !== "non_du",
														).length ?? 10;
													return (
														<tr key={student.id} className="border-b last:border-b-0">
															<td className="sticky left-0 bg-white px-4 py-2 font-medium whitespace-nowrap">
																{student.prenom} {student.nom}
															</td>
															{frais?.months.map((monthData) => (
																<td key={monthData.mois} className="px-2 py-2 text-center">
																	{monthData.statut === "inclus" ? (
																		<span
																			className="text-[10px] font-medium text-primary"
																			title="Inclus dans le forfait d'inscription"
																		>
																			Inclus
																		</span>
																	) : monthData.statut === "non_du" ? (
																		<span
																			className="text-xs text-gray-300"
																			title="Non dû selon l'échéancier"
																		>
																			—
																		</span>
																	) : monthData.paid ? (
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
																		paidCount >= dueCount
																			? "bg-green-100 text-green-700"
																			: paidCount > 0
																				? "bg-yellow-100 text-yellow-700"
																				: "bg-red-50 text-red-500",
																	)}
																>
																	{paidCount}/{dueCount}
																</span>
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
