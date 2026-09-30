"use client";

import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/shared/lib/trpc-client";
import { PageHeader, Button, StatusBadge } from "@/shared/ui";
import { formatDate } from "@/shared/lib/utils";
import { ArrowLeft, User, Phone, MapPin, Briefcase } from "lucide-react";

export default function EleveDetailPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();

	const student = trpc.students.getById.useQuery({ id });

	if (student.isLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-muted">Chargement...</div>
			</div>
		);
	}

	if (student.error || !student.data) {
		return (
			<div className="flex h-64 flex-col items-center justify-center gap-4">
				<p className="text-danger">Élève non trouvé</p>
				<Button variant="ghost" onClick={() => router.push("/eleves")}>
					<ArrowLeft className="h-4 w-4" />
					Retour à la liste
				</Button>
			</div>
		);
	}

	const s = student.data;

	return (
		<div>
			<PageHeader
				title={`${s.prenom} ${s.nom}`}
				breadcrumbs={[
					{ label: "Élèves", href: "/eleves" },
					{ label: `${s.prenom} ${s.nom}` },
				]}
				action={
					<Button variant="ghost" onClick={() => router.push("/eleves")}>
						<ArrowLeft className="h-4 w-4" />
						Retour
					</Button>
				}
			/>

			<div className="grid gap-6 md:grid-cols-2">
				{/* Info élève */}
				<div className="rounded-xl bg-surface p-6 shadow-sm">
					<h2 className="mb-4 text-lg font-semibold">Informations de l&apos;élève</h2>
					<div className="space-y-3">
						<InfoRow label="Matricule" value={s.matricule} />
						<InfoRow label="Prénom" value={s.prenom} />
						<InfoRow label="Nom" value={s.nom} />
						<InfoRow
							label="Date de naissance"
							value={s.dateNaissance ? formatDate(s.dateNaissance) : "—"}
						/>
						<InfoRow label="Lieu de naissance" value={s.lieuNaissance || "—"} />
						<InfoRow label="Sexe" value={s.sexe === "M" ? "Masculin" : "Féminin"} />
						<InfoRow label="Adresse" value={s.adresse || "—"} />
						<InfoRow label="Classe" value={s.classeNom} />
						<InfoRow label="Niveau" value={s.niveauNom} />
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted">Statut</span>
							<StatusBadge status={s.statut} />
						</div>
						<InfoRow
							label="Date d'inscription"
							value={s.createdAt ? formatDate(s.createdAt) : "—"}
						/>
					</div>
				</div>

				{/* Parents */}
				<div className="rounded-xl bg-surface p-6 shadow-sm">
					<h2 className="mb-4 text-lg font-semibold">Parent / Tuteur</h2>
					{s.parents.length === 0 ? (
						<p className="text-sm text-muted">Aucun parent enregistré</p>
					) : (
						<div className="space-y-4">
							{s.parents.map((p) => (
								<div key={p.id} className="rounded-lg bg-gray-50 p-4">
									<div className="mb-2 flex items-center gap-2">
										<User className="h-4 w-4 text-primary" />
										<span className="font-medium">
											{p.prenom} {p.nom}
										</span>
										<span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
											{p.relation === "pere"
												? "Père"
												: p.relation === "mere"
													? "Mère"
													: "Tuteur"}
										</span>
									</div>
									<div className="space-y-1.5 text-sm">
										<div className="flex items-center gap-2 text-muted">
											<Phone className="h-3.5 w-3.5" />
											{p.telephone}
											{p.telephone2 && ` / ${p.telephone2}`}
										</div>
										{p.profession && (
											<div className="flex items-center gap-2 text-muted">
												<Briefcase className="h-3.5 w-3.5" />
												{p.profession}
											</div>
										)}
										{p.adresse && (
											<div className="flex items-center gap-2 text-muted">
												<MapPin className="h-3.5 w-3.5" />
												{p.adresse}
											</div>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-sm text-muted">{label}</span>
			<span className="text-sm font-medium">{value}</span>
		</div>
	);
}
