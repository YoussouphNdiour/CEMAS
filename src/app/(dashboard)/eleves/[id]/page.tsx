"use client";

import { ArrowLeft, Briefcase, MapPin, Phone, Plus, User } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ReductionEleve } from "@/modules/finance/components/reduction-eleve";
import {
	CONTACT_VIDE,
	ContactFields,
	type ContactForm,
	contactComplet,
	RELATION_LABELS,
} from "@/modules/students/components/contact-fields";
import { trpc } from "@/shared/lib/trpc-client";
import { formatDate } from "@/shared/lib/utils";
import { Button, FormModal, PageHeader, StatusBadge } from "@/shared/ui";

const MAX_CONTACTS = 2;

export default function EleveDetailPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();

	const utils = trpc.useUtils();
	const student = trpc.students.getById.useQuery({ id });
	const [nouveauContact, setNouveauContact] = useState<ContactForm | null>(null);
	const addParent = trpc.students.addParent.useMutation({
		onSuccess: () => {
			setNouveauContact(null);
			utils.students.getById.invalidate({ id });
		},
	});

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
				breadcrumbs={[{ label: "Élèves", href: "/eleves" }, { label: `${s.prenom} ${s.nom}` }]}
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
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-lg font-semibold">Parents / Contacts</h2>
						{s.parents.length < MAX_CONTACTS && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setNouveauContact({ ...CONTACT_VIDE, relation: "mere" })}
							>
								<Plus className="h-4 w-4" />
								Ajouter un 2e contact
							</Button>
						)}
					</div>
					{s.parents.length === 0 ? (
						<p className="text-sm text-muted">Aucun parent enregistré</p>
					) : (
						<div className="space-y-4">
							{s.parents.map((p) => (
								<div key={p.id} data-testid="contact" className="rounded-lg bg-gray-50 p-4">
									<div className="mb-2 flex items-center gap-2">
										<User className="h-4 w-4 text-primary" />
										<span className="font-medium">
											{p.prenom} {p.nom}
										</span>
										<span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
											{RELATION_LABELS[p.relation as keyof typeof RELATION_LABELS] ?? p.relation}
										</span>
										{p.principal && (
											<span className="rounded bg-secondary/30 px-2 py-0.5 text-xs font-medium text-primary">
												Principal
											</span>
										)}
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

			<div className="mt-6">
				<ReductionEleve eleveId={id} />
			</div>

			<FormModal
				open={nouveauContact !== null}
				onClose={() => setNouveauContact(null)}
				title="Ajouter un 2e contact"
			>
				{nouveauContact && (
					<form
						onSubmit={(e) => {
							e.preventDefault();
							addParent.mutate({ eleveId: id, parent: nouveauContact });
						}}
						className="space-y-4"
					>
						<ContactFields
							idPrefix="nouveau-contact"
							value={nouveauContact}
							onChange={setNouveauContact}
						/>
						{addParent.error && <p className="text-sm text-danger">{addParent.error.message}</p>}
						<div className="flex justify-end gap-2">
							<Button type="button" variant="ghost" onClick={() => setNouveauContact(null)}>
								Annuler
							</Button>
							<Button
								type="submit"
								disabled={!contactComplet(nouveauContact) || addParent.isPending}
							>
								{addParent.isPending ? "Enregistrement..." : "Enregistrer"}
							</Button>
						</div>
					</form>
				)}
			</FormModal>
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
