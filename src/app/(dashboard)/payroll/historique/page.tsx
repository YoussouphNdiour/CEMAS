"use client";

import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { PageHeader } from "@/shared/ui";
import { formatCFA, MOIS_LABELS } from "@/shared/lib/utils";

type MonthSummary = {
	mois: number;
	totalBase: number;
	totalPrimes: number;
	totalRetenues: number;
	totalNet: number;
	nbPayes: number;
};

export default function HistoriquePage() {
	const now = new Date();
	const [annee, setAnnee] = useState(now.getFullYear());

	const historiqueQuery = trpc.payroll.historique.useQuery({ annee });

	const data: MonthSummary[] = historiqueQuery.data ?? [];

	const totals = data.reduce(
		(acc, row) => ({
			totalBase: acc.totalBase + row.totalBase,
			totalPrimes: acc.totalPrimes + row.totalPrimes,
			totalRetenues: acc.totalRetenues + row.totalRetenues,
			totalNet: acc.totalNet + row.totalNet,
			nbPayes: acc.nbPayes + row.nbPayes,
		}),
		{ totalBase: 0, totalPrimes: 0, totalRetenues: 0, totalNet: 0, nbPayes: 0 },
	);

	return (
		<div>
			<PageHeader
				title="Historique de la paie"
				breadcrumbs={[{ label: "Paie" }, { label: "Historique" }]}
			/>

			{/* Year selector */}
			<div className="mb-6">
				<label className="mb-1 block text-sm font-medium text-gray-700">Annee</label>
				<input
					type="number"
					value={annee}
					onChange={(e) => setAnnee(parseInt(e.target.value, 10) || now.getFullYear())}
					className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					min={2020}
					max={2100}
				/>
			</div>

			{/* Table */}
			<div className="rounded-xl border bg-surface shadow-sm overflow-x-auto">
				<table className="w-full text-left text-sm">
					<thead>
						<tr className="border-b bg-gray-50">
							<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
								Mois
							</th>
							<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted text-right">
								Total base
							</th>
							<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted text-right">
								Total primes
							</th>
							<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted text-right">
								Total retenues
							</th>
							<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted text-right">
								Total net
							</th>
							<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted text-right">
								Nb payes
							</th>
						</tr>
					</thead>
					<tbody>
						{data.map((row) => (
							<tr key={row.mois} className="border-b transition last:border-b-0 hover:bg-gray-50">
								<td className="whitespace-nowrap px-4 py-3 font-medium">
									{MOIS_LABELS[row.mois]}
								</td>
								<td className="whitespace-nowrap px-4 py-3 text-right">
									{formatCFA(row.totalBase)}
								</td>
								<td className="whitespace-nowrap px-4 py-3 text-right">
									{formatCFA(row.totalPrimes)}
								</td>
								<td className="whitespace-nowrap px-4 py-3 text-right">
									{formatCFA(row.totalRetenues)}
								</td>
								<td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
									{formatCFA(row.totalNet)}
								</td>
								<td className="whitespace-nowrap px-4 py-3 text-right">
									{row.nbPayes}
								</td>
							</tr>
						))}
					</tbody>
					<tfoot>
						<tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
							<td className="whitespace-nowrap px-4 py-3">
								Total annuel
							</td>
							<td className="whitespace-nowrap px-4 py-3 text-right">
								{formatCFA(totals.totalBase)}
							</td>
							<td className="whitespace-nowrap px-4 py-3 text-right">
								{formatCFA(totals.totalPrimes)}
							</td>
							<td className="whitespace-nowrap px-4 py-3 text-right">
								{formatCFA(totals.totalRetenues)}
							</td>
							<td className="whitespace-nowrap px-4 py-3 text-right">
								{formatCFA(totals.totalNet)}
							</td>
							<td className="whitespace-nowrap px-4 py-3 text-right">
								{totals.nbPayes}
							</td>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>
	);
}
