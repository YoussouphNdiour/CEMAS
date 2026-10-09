"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import type { Column } from "@/shared/ui";
import { Button, ConfirmDialog, DataTable, FormModal, PageHeader } from "@/shared/ui";

type AffectationRow = Record<string, unknown> & {
	id: string;
	eleveId: string;
	itineraireId: string;
	arretId: string;
	anneeScolaireId: string;
	elevePrenom: string;
	eleveNom: string;
	eleveMatricule: string;
	itineraireNom: string;
	arretNom: string;
};

type EleveOption = {
	id: string;
	matricule: string;
	prenom: string;
	nom: string;
};

export default function AffectationsPage() {
	const utils = trpc.useUtils();

	// Get active year
	const { data: annees = [] } = trpc.academic.annees.list.useQuery();
	const activeAnnee = annees.find((a) => a.active) ?? annees[0];

	// Affectations list
	const { data: affectationsList = [], isLoading } = trpc.transport.affectations.list.useQuery(
		{ anneeScolaireId: activeAnnee?.id ?? "" },
		{ enabled: !!activeAnnee },
	);

	// For the form: itineraires, students
	const { data: itinerairesList = [] } = trpc.transport.itineraires.list.useQuery();

	// Students for the active year
	const { data: studentsList = [] } = trpc.students.list.useQuery(
		{ anneeScolaireId: activeAnnee?.id ?? "" },
		{ enabled: !!activeAnnee },
	);

	// Selected itineraire for filtering arrets
	const [selectedItineraireId, setSelectedItineraireId] = useState("");

	const { data: arretsList = [] } = trpc.transport.arrets.listByItineraire.useQuery(
		{ itineraireId: selectedItineraireId },
		{ enabled: !!selectedItineraireId },
	);

	const createMutation = trpc.transport.affectations.create.useMutation({
		onSuccess: () => {
			utils.transport.affectations.list.invalidate();
			closeModal();
		},
	});

	const deleteMutation = trpc.transport.affectations.delete.useMutation({
		onSuccess: () => {
			utils.transport.affectations.list.invalidate();
			setDeleteTarget(null);
		},
	});

	const [modalOpen, setModalOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<AffectationRow | null>(null);

	// Form state
	const [eleveId, setEleveId] = useState("");
	const [itineraireId, setItineraireId] = useState("");
	const [arretId, setArretId] = useState("");
	const [studentSearch, setStudentSearch] = useState("");

	function openCreate() {
		setEleveId("");
		setItineraireId("");
		setArretId("");
		setSelectedItineraireId("");
		setStudentSearch("");
		setModalOpen(true);
	}

	function closeModal() {
		setModalOpen(false);
		setEleveId("");
		setItineraireId("");
		setArretId("");
		setSelectedItineraireId("");
		setStudentSearch("");
	}

	function handleItineraireChange(value: string) {
		setItineraireId(value);
		setSelectedItineraireId(value);
		setArretId("");
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!activeAnnee) return;
		createMutation.mutate({
			eleveId,
			itineraireId,
			arretId,
			anneeScolaireId: activeAnnee.id,
		});
	}

	// Filter students by search term
	const filteredStudents = studentSearch.trim()
		? (studentsList as EleveOption[]).filter((s) => {
				const q = studentSearch.toLowerCase();
				return (
					s.prenom.toLowerCase().includes(q) ||
					s.nom.toLowerCase().includes(q) ||
					s.matricule.toLowerCase().includes(q)
				);
			})
		: (studentsList as EleveOption[]);

	const columns: Column<AffectationRow>[] = [
		{
			key: "eleveMatricule",
			label: "Matricule",
			sortable: true,
		},
		{
			key: "eleveNom",
			label: "Élève",
			sortable: true,
			render: (row) => `${row.elevePrenom} ${row.eleveNom}`,
		},
		{
			key: "itineraireNom",
			label: "Itinéraire",
			sortable: true,
		},
		{
			key: "arretNom",
			label: "Arrêt",
			sortable: true,
		},
		{
			key: "actions",
			label: "Actions",
			render: (row) => (
				<Button
					variant="ghost"
					size="sm"
					onClick={(e) => {
						e.stopPropagation();
						setDeleteTarget(row);
					}}
					title="Supprimer"
				>
					<Trash2 className="h-4 w-4 text-red-500" />
				</Button>
			),
		},
	];

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20">
				<p className="text-muted">Chargement...</p>
			</div>
		);
	}

	return (
		<div>
			<PageHeader
				title="Affectations transport"
				breadcrumbs={[{ label: "Transport" }, { label: "Affectations" }]}
				action={
					<Button onClick={openCreate} disabled={!activeAnnee}>
						<Plus className="h-4 w-4" />
						Nouvelle affectation
					</Button>
				}
			/>

			{!activeAnnee && (
				<div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
					Aucune année scolaire active. Veuillez en activer une dans la section Années scolaires.
				</div>
			)}

			<DataTable
				columns={columns}
				data={affectationsList as AffectationRow[]}
				searchPlaceholder="Rechercher une affectation..."
			/>

			<FormModal open={modalOpen} onClose={closeModal} title="Nouvelle affectation">
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">Élève</label>
						<input
							type="text"
							value={studentSearch}
							onChange={(e) => setStudentSearch(e.target.value)}
							placeholder="Rechercher par nom ou matricule..."
							className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
						<select
							required
							value={eleveId}
							onChange={(e) => setEleveId(e.target.value)}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						>
							<option value="">Sélectionner un élève</option>
							{filteredStudents.slice(0, 50).map((s) => (
								<option key={s.id} value={s.id}>
									{s.matricule} — {s.prenom} {s.nom}
								</option>
							))}
						</select>
					</div>

					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">Itinéraire</label>
						<select
							required
							value={itineraireId}
							onChange={(e) => handleItineraireChange(e.target.value)}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						>
							<option value="">Sélectionner un itinéraire</option>
							{itinerairesList.map((i) => (
								<option key={i.id} value={i.id}>
									{i.nom}
								</option>
							))}
						</select>
					</div>

					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">Arrêt</label>
						<select
							required
							value={arretId}
							onChange={(e) => setArretId(e.target.value)}
							disabled={!itineraireId}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
						>
							<option value="">
								{itineraireId ? "Sélectionner un arrêt" : "Choisissez d'abord un itinéraire"}
							</option>
							{arretsList.map((a) => (
								<option key={a.id} value={a.id}>
									{a.ordre}. {a.nom}
									{a.heurePassage ? ` (${a.heurePassage})` : ""}
								</option>
							))}
						</select>
					</div>

					<div className="flex items-center justify-end gap-3 pt-2">
						<Button variant="ghost" type="button" onClick={closeModal}>
							Annuler
						</Button>
						<Button type="submit" disabled={createMutation.isPending}>
							{createMutation.isPending ? "Enregistrement..." : "Créer"}
						</Button>
					</div>
				</form>
			</FormModal>

			<ConfirmDialog
				open={!!deleteTarget}
				onClose={() => setDeleteTarget(null)}
				onConfirm={() => {
					if (deleteTarget) deleteMutation.mutate({ id: deleteTarget.id });
				}}
				title="Supprimer l'affectation"
				message={
					deleteTarget
						? `Voulez-vous vraiment retirer ${deleteTarget.elevePrenom} ${deleteTarget.eleveNom} de l'itinéraire "${deleteTarget.itineraireNom}" ? Cette action est irréversible.`
						: ""
				}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
