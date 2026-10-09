"use client";

import { Briefcase, CreditCard, DollarSign, Receipt, TrendingUp } from "lucide-react";
import { trpc } from "@/shared/lib/trpc-client";
import { formatCFA, MOIS_LABELS } from "@/shared/lib/utils";
import { PageHeader, StatCard } from "@/shared/ui";

const signeClasse = (n: number) => (n >= 0 ? "text-green-600" : "text-red-600");
const montantOuTiret = (n: number) => (n === 0 ? "—" : formatCFA(n));

export default function BilanPage() {
	const annees = trpc.academic.annees.list.useQuery();
	const activeAnnee = annees.data?.find((a) => a.active);

	const bilan = trpc.finance.bilan.summary.useQuery(
		{ anneeScolaireId: activeAnnee?.id ?? "" },
		{ enabled: !!activeAnnee?.id },
	);

	const d = bilan.data;
	const solde = d?.solde ?? 0;

	return (
		<div>
			<PageHeader
				title="Bilan financier"
				breadcrumbs={[{ label: "Finances", href: "/finances/paiements" }, { label: "Bilan" }]}
			/>

			{activeAnnee && (
				<div className="mb-6">
					<span className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
						Année : {activeAnnee.libelle}
					</span>
				</div>
			)}

			{!activeAnnee && (
				<div className="mb-6 rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-800">
					Aucune année scolaire active.
				</div>
			)}

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
				<StatCard
					title="Total paiements"
					value={formatCFA(d?.totalPaiements ?? 0)}
					icon={CreditCard}
				/>
				<StatCard
					title="Total recettes"
					value={formatCFA(d?.totalRecettes ?? 0)}
					icon={DollarSign}
				/>
				<StatCard title="Total dépenses" value={formatCFA(d?.totalDepenses ?? 0)} icon={Receipt} />
				<StatCard
					title="Salaires payés"
					value={formatCFA(d?.totalSalaires ?? 0)}
					icon={Briefcase}
				/>
				<StatCard
					title="Solde"
					value={formatCFA(solde)}
					icon={TrendingUp}
					trendUp={solde >= 0}
					trend={solde >= 0 ? "Positif" : "Négatif"}
				/>
			</div>

			{/* Breakdown */}
			<div className="mt-8 rounded-xl bg-surface p-6 shadow-sm">
				<h2 className="mb-4 text-lg font-semibold">Détail</h2>
				<div className="space-y-3">
					<div className="flex items-center justify-between border-b pb-3">
						<span className="text-sm text-muted">Paiements scolarité (encaissés)</span>
						<span className="text-sm font-semibold text-green-600">
							+{formatCFA(d?.totalPaiements ?? 0)}
						</span>
					</div>
					<div className="flex items-center justify-between border-b pb-3">
						<span className="text-sm text-muted">Autres recettes</span>
						<span className="text-sm font-semibold text-green-600">
							+{formatCFA(d?.totalRecettes ?? 0)}
						</span>
					</div>
					<div className="flex items-center justify-between border-b pb-3">
						<span className="text-sm text-muted">Dépenses</span>
						<span className="text-sm font-semibold text-red-600">
							-{formatCFA(d?.totalDepenses ?? 0)}
						</span>
					</div>
					<div className="flex items-center justify-between border-b pb-3">
						<span className="text-sm text-muted">Salaires payés</span>
						<span className="text-sm font-semibold text-red-600">
							-{formatCFA(d?.totalSalaires ?? 0)}
						</span>
					</div>
					<div className="flex items-center justify-between pt-2">
						<span className="text-base font-bold">Solde net</span>
						<span className={`text-base font-bold ${signeClasse(solde)}`}>{formatCFA(solde)}</span>
					</div>
				</div>
			</div>

			{/* Monthly detail (cash basis) */}
			<div className="mt-8 rounded-xl bg-surface p-6 shadow-sm">
				<h2 className="mb-1 text-lg font-semibold">Détail par mois</h2>
				<p className="mb-4 text-xs text-muted">
					Montants rattachés au mois d'encaissement ou de décaissement.
				</p>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b text-left text-xs uppercase text-muted">
								<th className="px-3 py-2">Mois</th>
								<th className="px-3 py-2 text-right">Paiements</th>
								<th className="px-3 py-2 text-right">Recettes</th>
								<th className="px-3 py-2 text-right">Dépenses</th>
								<th className="px-3 py-2 text-right">Salaires</th>
								<th className="px-3 py-2 text-right">Solde du mois</th>
								<th className="px-3 py-2 text-right">Solde cumulé</th>
							</tr>
						</thead>
						<tbody>
							{d?.mois.map((l) => (
								<tr key={`${l.annee}-${l.mois}`} className="border-b last:border-0">
									<td className="whitespace-nowrap px-3 py-2">
										{MOIS_LABELS[l.mois]} {l.annee}
									</td>
									<td className="px-3 py-2 text-right">{montantOuTiret(l.paiements)}</td>
									<td className="px-3 py-2 text-right">{montantOuTiret(l.recettes)}</td>
									<td className="px-3 py-2 text-right">{montantOuTiret(l.depenses)}</td>
									<td className="px-3 py-2 text-right">{montantOuTiret(l.salaires)}</td>
									<td className={`px-3 py-2 text-right font-medium ${signeClasse(l.solde)}`}>
										{formatCFA(l.solde)}
									</td>
									<td className={`px-3 py-2 text-right ${signeClasse(l.soldeCumule)}`}>
										{formatCFA(l.soldeCumule)}
									</td>
								</tr>
							))}
						</tbody>
						{d && (
							<tfoot>
								<tr className="border-t-2 font-semibold">
									<td className="px-3 py-2">Total</td>
									<td className="px-3 py-2 text-right">{formatCFA(d.totalPaiements)}</td>
									<td className="px-3 py-2 text-right">{formatCFA(d.totalRecettes)}</td>
									<td className="px-3 py-2 text-right">{formatCFA(d.totalDepenses)}</td>
									<td className="px-3 py-2 text-right">{formatCFA(d.totalSalaires)}</td>
									<td className={`px-3 py-2 text-right ${signeClasse(solde)}`}>
										{formatCFA(solde)}
									</td>
									<td />
								</tr>
							</tfoot>
						)}
					</table>
				</div>
			</div>
		</div>
	);
}
