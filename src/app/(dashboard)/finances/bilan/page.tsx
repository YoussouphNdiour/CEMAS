"use client";

import { trpc } from "@/shared/lib/trpc-client";
import { PageHeader, StatCard } from "@/shared/ui";
import { formatCFA } from "@/shared/lib/utils";
import { CreditCard, Receipt, DollarSign, TrendingUp } from "lucide-react";

export default function BilanPage() {
	const annees = trpc.academic.annees.list.useQuery();
	const activeAnnee = annees.data?.find((a) => a.active);

	const bilan = trpc.finance.bilan.summary.useQuery(
		{ anneeScolaireId: activeAnnee?.id ?? "" },
		{ enabled: !!activeAnnee?.id },
	);

	const d = bilan.data;

	return (
		<div>
			<PageHeader
				title="Bilan financier"
				breadcrumbs={[
					{ label: "Finances", href: "/finances/paiements" },
					{ label: "Bilan" },
				]}
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

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
				<StatCard
					title="Total dépenses"
					value={formatCFA(d?.totalDepenses ?? 0)}
					icon={Receipt}
				/>
				<StatCard
					title="Solde"
					value={formatCFA(d?.solde ?? 0)}
					icon={TrendingUp}
					trendUp={(d?.solde ?? 0) >= 0}
					trend={(d?.solde ?? 0) >= 0 ? "Positif" : "Négatif"}
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
					<div className="flex items-center justify-between pt-2">
						<span className="text-base font-bold">Solde net</span>
						<span
							className={`text-base font-bold ${(d?.solde ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{formatCFA(d?.solde ?? 0)}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
