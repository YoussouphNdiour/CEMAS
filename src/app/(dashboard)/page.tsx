import { Users, GraduationCap, BadgePercent, Banknote } from "lucide-react";

export default function DashboardPage() {
	return (
		<div>
			<h1 className="mb-6 text-2xl font-bold">Tableau de bord</h1>

			<div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div className="rounded-xl bg-surface p-6 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-muted">Total Élèves</p>
							<p className="mt-1 text-2xl font-bold">0</p>
						</div>
						<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light">
							<Users className="h-6 w-6 text-primary" />
						</div>
					</div>
				</div>
				<div className="rounded-xl bg-surface p-6 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-muted">Classes</p>
							<p className="mt-1 text-2xl font-bold">9</p>
						</div>
						<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light">
							<GraduationCap className="h-6 w-6 text-primary" />
						</div>
					</div>
				</div>
				<div className="rounded-xl bg-surface p-6 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-muted">Recouvrement</p>
							<p className="mt-1 text-2xl font-bold">0%</p>
						</div>
						<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light">
							<BadgePercent className="h-6 w-6 text-primary" />
						</div>
					</div>
				</div>
				<div className="rounded-xl bg-surface p-6 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-muted">Masse salariale</p>
							<p className="mt-1 text-2xl font-bold">0 FCFA</p>
						</div>
						<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light">
							<Banknote className="h-6 w-6 text-primary" />
						</div>
					</div>
				</div>
			</div>

			<div className="rounded-xl bg-surface p-6 shadow-sm">
				<h2 className="mb-4 text-lg font-semibold">Derniers paiements</h2>
				<p className="text-sm text-muted">Aucun paiement enregistré pour le moment.</p>
			</div>
		</div>
	);
}
