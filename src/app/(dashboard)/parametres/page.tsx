"use client";

import { useSession } from "next-auth/react";
import { trpc } from "@/shared/lib/trpc-client";
import { PageHeader, Button, StatCard } from "@/shared/ui";
import { Settings, Calendar, User, Shield } from "lucide-react";

export default function ParametresPage() {
	const { data: session } = useSession();
	const annees = trpc.academic.annees.list.useQuery();
	const activeAnnee = annees.data?.find((a) => a.active);
	const niveaux = trpc.academic.niveaux.list.useQuery();

	return (
		<div>
			<PageHeader
				title="Paramètres"
				breadcrumbs={[{ label: "Paramètres" }]}
			/>

			{/* School info */}
			<div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					title="École"
					value="CEMAS"
					icon={Settings}
				/>
				<StatCard
					title="Année active"
					value={activeAnnee?.libelle ?? "Aucune"}
					icon={Calendar}
				/>
				<StatCard
					title="Niveaux"
					value={String(niveaux.data?.length ?? 0)}
					icon={Shield}
				/>
				<StatCard
					title="Utilisateur"
					value={session?.user?.name ?? "Directeur"}
					icon={User}
				/>
			</div>

			{/* Account section */}
			<div className="mx-auto max-w-2xl space-y-6">
				<div className="rounded-xl bg-surface p-6 shadow-sm">
					<h2 className="mb-4 text-lg font-semibold">Informations du compte</h2>
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted">Nom</span>
							<span className="text-sm font-medium">
								{session?.user?.name ?? "—"}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted">Email</span>
							<span className="text-sm font-medium">
								{session?.user?.email ?? "—"}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted">Rôle</span>
							<span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
								Directeur
							</span>
						</div>
					</div>
				</div>

				{/* Niveaux overview */}
				<div className="rounded-xl bg-surface p-6 shadow-sm">
					<h2 className="mb-4 text-lg font-semibold">Niveaux scolaires</h2>
					{niveaux.data?.length ? (
						<div className="space-y-2">
							{niveaux.data.map((n) => (
								<div
									key={n.id}
									className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5"
								>
									<span className="text-sm font-medium">{n.nom}</span>
									<span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
										Ordre {n.ordre}
									</span>
								</div>
							))}
						</div>
					) : (
						<p className="text-sm text-muted">Aucun niveau configuré.</p>
					)}
				</div>

				{/* About */}
				<div className="rounded-xl bg-surface p-6 shadow-sm">
					<h2 className="mb-4 text-lg font-semibold">À propos</h2>
					<div className="space-y-2 text-sm">
						<p>
							<span className="text-muted">Application :</span>{" "}
							<span className="font-medium">CEMAS - Gestion Scolaire</span>
						</p>
						<p>
							<span className="text-muted">Établissement :</span>{" "}
							<span className="font-medium">
								Complexe Éducatif Mame Anta Sidibé
							</span>
						</p>
						<p>
							<span className="text-muted">Niveaux :</span>{" "}
							<span className="font-medium">
								Crèche, Préscolaire, Élémentaire
							</span>
						</p>
						<p>
							<span className="text-muted">Version :</span>{" "}
							<span className="font-medium">1.0.0</span>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
