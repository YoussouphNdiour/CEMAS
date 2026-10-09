"use client";

import { Banknote, Briefcase, GraduationCap, Receipt, TrendingUp, Users } from "lucide-react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { trpc } from "@/shared/lib/trpc-client";
import { formatCFA, MOIS_LABELS } from "@/shared/lib/utils";
import { StatCard } from "@/shared/ui";

const PIE_COLORS = ["#665d9d", "#fbc616", "#8b82b8", "#fdd44b", "#4a4271", "#e5a900"];

export default function DashboardPage() {
	const annees = trpc.academic.annees.list.useQuery();
	const activeAnnee = annees.data?.find((a) => a.active);

	const stats = trpc.dashboard.stats.useQuery(
		{ anneeScolaireId: activeAnnee?.id ?? "" },
		{ enabled: !!activeAnnee?.id },
	);

	const studentsByNiveau = trpc.dashboard.studentsByNiveau.useQuery(
		{ anneeScolaireId: activeAnnee?.id ?? "" },
		{ enabled: !!activeAnnee?.id },
	);

	const recentPayments = trpc.dashboard.recentPayments.useQuery(
		{ anneeScolaireId: activeAnnee?.id ?? "" },
		{ enabled: !!activeAnnee?.id },
	);

	const monthlyRevenue = trpc.dashboard.monthlyRevenue.useQuery(
		{ anneeScolaireId: activeAnnee?.id ?? "" },
		{ enabled: !!activeAnnee?.id },
	);

	const d = stats.data;
	const revenueData = (monthlyRevenue.data ?? []).map((r) => ({
		mois: MOIS_LABELS[r.mois]?.slice(0, 3) ?? String(r.mois),
		montant: r.total,
	}));

	const pieData = (studentsByNiveau.data ?? []).map((r) => ({
		name: r.niveauNom,
		value: r.count,
	}));

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-2xl font-bold">Tableau de bord</h1>
				{activeAnnee && (
					<span className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
						{activeAnnee.libelle}
					</span>
				)}
			</div>

			{!activeAnnee && (
				<div className="mb-6 rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-800">
					Aucune année scolaire active. Configurez-en une dans Académique → Années scolaires.
				</div>
			)}

			{/* KPI Cards */}
			<div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
				<StatCard title="Élèves" value={String(d?.totalEleves ?? 0)} icon={Users} />
				<StatCard title="Classes" value={String(d?.totalClasses ?? 0)} icon={GraduationCap} />
				<StatCard title="Paiements" value={formatCFA(d?.totalPaiements ?? 0)} icon={TrendingUp} />
				<StatCard title="Dépenses" value={formatCFA(d?.totalDepenses ?? 0)} icon={Receipt} />
				<StatCard title="Employés" value={String(d?.totalEmployes ?? 0)} icon={Briefcase} />
				<StatCard
					title="Masse salariale"
					value={formatCFA(d?.masseSalariale ?? 0)}
					icon={Banknote}
				/>
			</div>

			{/* Charts row */}
			<div className="mb-8 grid gap-6 lg:grid-cols-2">
				{/* Monthly revenue chart */}
				<div className="rounded-xl bg-surface p-6 shadow-sm">
					<h2 className="mb-4 text-lg font-semibold">Paiements par mois</h2>
					{revenueData.length > 0 ? (
						<ResponsiveContainer width="100%" height={280}>
							<BarChart data={revenueData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="mois" tick={{ fontSize: 12 }} />
								<YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
								<Tooltip formatter={(value) => [formatCFA(Number(value)), "Montant"]} />
								<Bar dataKey="montant" fill="#665d9d" radius={[4, 4, 0, 0]} />
							</BarChart>
						</ResponsiveContainer>
					) : (
						<p className="py-12 text-center text-sm text-muted">Aucun paiement enregistré</p>
					)}
				</div>

				{/* Students by niveau pie chart */}
				<div className="rounded-xl bg-surface p-6 shadow-sm">
					<h2 className="mb-4 text-lg font-semibold">Élèves par niveau</h2>
					{pieData.length > 0 ? (
						<div className="flex items-center justify-center gap-6">
							<ResponsiveContainer width="50%" height={280}>
								<PieChart>
									<Pie
										data={pieData}
										cx="50%"
										cy="50%"
										innerRadius={60}
										outerRadius={100}
										dataKey="value"
									>
										{pieData.map((_, i) => (
											<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
										))}
									</Pie>
									<Tooltip />
								</PieChart>
							</ResponsiveContainer>
							<div className="space-y-2">
								{pieData.map((d, i) => (
									<div key={d.name} className="flex items-center gap-2 text-sm">
										<div
											className="h-3 w-3 rounded-full"
											style={{
												backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
											}}
										/>
										<span>
											{d.name}: {d.value}
										</span>
									</div>
								))}
							</div>
						</div>
					) : (
						<p className="py-12 text-center text-sm text-muted">Aucun élève inscrit</p>
					)}
				</div>
			</div>

			{/* Recent payments */}
			<div className="rounded-xl bg-surface p-6 shadow-sm">
				<h2 className="mb-4 text-lg font-semibold">Derniers paiements</h2>
				{(recentPayments.data?.length ?? 0) > 0 ? (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm">
							<thead>
								<tr className="border-b bg-gray-50">
									<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
										Reçu
									</th>
									<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
										Élève
									</th>
									<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
										Type
									</th>
									<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
										Mois
									</th>
									<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted text-right">
										Montant
									</th>
								</tr>
							</thead>
							<tbody>
								{recentPayments.data!.map((p) => (
									<tr key={p.id} className="border-b last:border-b-0">
										<td className="px-4 py-3 font-mono text-xs">{p.numeroRecu}</td>
										<td className="px-4 py-3 font-medium">
											{p.elevePrenom} {p.eleveNom}
										</td>
										<td className="px-4 py-3">{p.typeFraisNom}</td>
										<td className="px-4 py-3">{MOIS_LABELS[p.mois] ?? p.mois}</td>
										<td className="px-4 py-3 text-right font-semibold">{formatCFA(p.montant)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<p className="text-sm text-muted">Aucun paiement enregistré pour le moment.</p>
				)}
			</div>
		</div>
	);
}
