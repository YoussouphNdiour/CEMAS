"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import type { Column } from "@/shared/ui";
import { Button, ConfirmDialog, DataTable, FormModal, PageHeader } from "@/shared/ui";

type Niveau = {
	id: string;
	nom: string;
	ordre: number;
};

type Matiere = Record<string, unknown> & {
	id: string;
	nom: string;
	coefficient: number;
	niveauId: string;
	niveau: Niveau;
};

export default function MatieresPage() {
	const utils = trpc.useUtils();

	const { data: niveauxList = [] } = trpc.academic.niveaux.list.useQuery();

	const [filterNiveauId, setFilterNiveauId] = useState<string>("");

	const { data: matieresList = [], isLoading } = trpc.academic.matieres.list.useQuery(
		filterNiveauId ? { niveauId: filterNiveauId } : undefined,
	);

	const createMutation = trpc.academic.matieres.create.useMutation({
		onSuccess: () => {
			utils.academic.matieres.list.invalidate();
			closeModal();
		},
	});

	const updateMutation = trpc.academic.matieres.update.useMutation({
		onSuccess: () => {
			utils.academic.matieres.list.invalidate();
			closeModal();
		},
	});

	const deleteMutation = trpc.academic.matieres.delete.useMutation({
		onSuccess: () => {
			utils.academic.matieres.list.invalidate();
			setDeleteTarget(null);
		},
	});

	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<Matiere | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<Matiere | null>(null);

	// Form state
	const [nom, setNom] = useState("");
	const [coefficient, setCoefficient] = useState(1);
	const [niveauId, setNiveauId] = useState("");

	function openCreate() {
		setEditing(null);
		setNom("");
		setCoefficient(1);
		setNiveauId(niveauxList[0]?.id ?? "");
		setModalOpen(true);
	}

	function openEdit(matiere: Matiere) {
		setEditing(matiere);
		setNom(matiere.nom);
		setCoefficient(matiere.coefficient);
		setNiveauId(matiere.niveauId);
		setModalOpen(true);
	}

	function closeModal() {
		setModalOpen(false);
		setEditing(null);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (editing) {
			updateMutation.mutate({
				id: editing.id,
				nom,
				coefficient,
			});
		} else {
			createMutation.mutate({
				nom,
				coefficient,
				niveauId,
			});
		}
	}

	const isSaving = createMutation.isPending || updateMutation.isPending;

	const columns: Column<Matiere>[] = [
		{ key: "nom", label: "Nom", sortable: true },
		{ key: "coefficient", label: "Coefficient", sortable: true },
		{
			key: "niveau",
			label: "Niveau",
			render: (row) => row.niveau?.nom ?? "-",
		},
		{
			key: "actions",
			label: "Actions",
			render: (row) => (
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={(e) => {
							e.stopPropagation();
							openEdit(row);
						}}
						title="Modifier"
					>
						<Pencil className="h-4 w-4" />
					</Button>
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
				</div>
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
				title="Matières"
				breadcrumbs={[{ label: "Académique" }, { label: "Matières" }]}
				action={
					<Button onClick={openCreate}>
						<Plus className="h-4 w-4" />
						Nouvelle matière
					</Button>
				}
			/>

			{/* Filter */}
			<div className="mb-4">
				<select
					value={filterNiveauId}
					onChange={(e) => setFilterNiveauId(e.target.value)}
					className="rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
				>
					<option value="">Tous les niveaux</option>
					{niveauxList.map((n) => (
						<option key={n.id} value={n.id}>
							{n.nom}
						</option>
					))}
				</select>
			</div>

			<DataTable
				columns={columns}
				data={matieresList as Matiere[]}
				searchPlaceholder="Rechercher une matière..."
			/>

			<FormModal
				open={modalOpen}
				onClose={closeModal}
				title={editing ? "Modifier la matière" : "Nouvelle matière"}
			>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
						<input
							type="text"
							value={nom}
							onChange={(e) => setNom(e.target.value)}
							placeholder="Ex: Mathématiques"
							required
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">Coefficient</label>
						<input
							type="number"
							value={coefficient}
							onChange={(e) => setCoefficient(Number(e.target.value))}
							min={1}
							required
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">Niveau</label>
						<select
							value={niveauId}
							onChange={(e) => setNiveauId(e.target.value)}
							required
							disabled={!!editing}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
						>
							<option value="">Sélectionner un niveau</option>
							{niveauxList.map((n) => (
								<option key={n.id} value={n.id}>
									{n.nom}
								</option>
							))}
						</select>
					</div>
					<div className="flex items-center justify-end gap-3 pt-2">
						<Button variant="ghost" type="button" onClick={closeModal}>
							Annuler
						</Button>
						<Button type="submit" disabled={isSaving}>
							{isSaving ? "Enregistrement..." : editing ? "Modifier" : "Créer"}
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
				title="Supprimer la matière"
				message={`Voulez-vous vraiment supprimer la matière "${deleteTarget?.nom}" ? Cette action est irréversible.`}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
