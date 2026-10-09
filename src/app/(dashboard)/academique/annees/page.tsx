"use client";

import { Archive, CheckCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { formatDate } from "@/shared/lib/utils";
import type { Column } from "@/shared/ui";
import { Button, ConfirmDialog, DataTable, FormModal, PageHeader, StatusBadge } from "@/shared/ui";

type Annee = Record<string, unknown> & {
	id: string;
	libelle: string;
	dateDebut: string;
	dateFin: string;
	active: boolean;
	archived: boolean;
	createdAt: string | null;
	updatedAt: string | null;
};

export default function AnneesPage() {
	const utils = trpc.useUtils();
	const { data: annees = [], isLoading } = trpc.academic.annees.list.useQuery();

	const createMutation = trpc.academic.annees.create.useMutation({
		onSuccess: () => {
			utils.academic.annees.list.invalidate();
			closeModal();
		},
	});

	const updateMutation = trpc.academic.annees.update.useMutation({
		onSuccess: () => {
			utils.academic.annees.list.invalidate();
			closeModal();
		},
	});

	const deleteMutation = trpc.academic.annees.delete.useMutation({
		onSuccess: () => {
			utils.academic.annees.list.invalidate();
			setDeleteTarget(null);
		},
	});

	const setActiveMutation = trpc.academic.annees.setActive.useMutation({
		onSuccess: () => {
			utils.academic.annees.list.invalidate();
		},
	});

	const archiveMutation = trpc.academic.annees.archive.useMutation({
		onSuccess: () => {
			utils.academic.annees.list.invalidate();
			setArchiveTarget(null);
		},
	});

	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<Annee | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<Annee | null>(null);
	const [archiveTarget, setArchiveTarget] = useState<Annee | null>(null);

	// Form state
	const [libelle, setLibelle] = useState("");
	const [dateDebut, setDateDebut] = useState("");
	const [dateFin, setDateFin] = useState("");

	function openCreate() {
		setEditing(null);
		setLibelle("");
		setDateDebut("");
		setDateFin("");
		setModalOpen(true);
	}

	function openEdit(annee: Annee) {
		setEditing(annee);
		setLibelle(annee.libelle);
		setDateDebut(annee.dateDebut);
		setDateFin(annee.dateFin);
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
				libelle,
				dateDebut,
				dateFin,
			});
		} else {
			createMutation.mutate({ libelle, dateDebut, dateFin });
		}
	}

	const isSaving = createMutation.isPending || updateMutation.isPending;

	const columns: Column<Annee>[] = [
		{ key: "libelle", label: "Libellé", sortable: true },
		{
			key: "dateDebut",
			label: "Début",
			render: (row) => formatDate(row.dateDebut),
		},
		{
			key: "dateFin",
			label: "Fin",
			render: (row) => formatDate(row.dateFin),
		},
		{
			key: "active",
			label: "Statut",
			render: (row) =>
				row.archived ? (
					<span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
						Archivée
					</span>
				) : (
					<StatusBadge status={row.active ? "actif" : "inactif"} />
				),
		},
		{
			key: "actions",
			label: "Actions",
			render: (row) => (
				<div className="flex items-center gap-1">
					{row.archived ? (
						<span className="text-xs text-gray-400">Lecture seule</span>
					) : (
						<>
							{!row.active && (
								<Button
									variant="ghost"
									size="sm"
									onClick={(e) => {
										e.stopPropagation();
										setActiveMutation.mutate({ id: row.id });
									}}
									disabled={setActiveMutation.isPending}
									title="Activer"
								>
									<CheckCircle className="h-4 w-4 text-green-600" />
								</Button>
							)}
							{!row.active && (
								<Button
									variant="ghost"
									size="sm"
									onClick={(e) => {
										e.stopPropagation();
										setArchiveTarget(row);
									}}
									title="Archiver"
								>
									<Archive className="h-4 w-4 text-amber-600" />
								</Button>
							)}
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
							{!row.active && (
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
							)}
						</>
					)}
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
				title="Années scolaires"
				breadcrumbs={[{ label: "Académique" }, { label: "Années scolaires" }]}
				action={
					<Button onClick={openCreate}>
						<Plus className="h-4 w-4" />
						Nouvelle année
					</Button>
				}
			/>

			<DataTable
				columns={columns}
				data={annees as Annee[]}
				searchPlaceholder="Rechercher une année..."
			/>

			<FormModal
				open={modalOpen}
				onClose={closeModal}
				title={editing ? "Modifier l'année" : "Nouvelle année scolaire"}
			>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">Libellé</label>
						<input
							type="text"
							value={libelle}
							onChange={(e) => setLibelle(e.target.value)}
							placeholder="Ex: 2024-2025"
							required
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">Date de début</label>
						<input
							type="date"
							value={dateDebut}
							onChange={(e) => setDateDebut(e.target.value)}
							required
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">Date de fin</label>
						<input
							type="date"
							value={dateFin}
							onChange={(e) => setDateFin(e.target.value)}
							required
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
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
				title="Supprimer l'année scolaire"
				message={`Voulez-vous vraiment supprimer l'année "${deleteTarget?.libelle}" ? Cette action est irréversible.`}
				loading={deleteMutation.isPending}
			/>

			<ConfirmDialog
				open={!!archiveTarget}
				onClose={() => setArchiveTarget(null)}
				onConfirm={() => {
					if (archiveTarget) archiveMutation.mutate({ id: archiveTarget.id });
				}}
				title="Archiver l'année scolaire"
				message={`Voulez-vous archiver l'année "${archiveTarget?.libelle}" ? Les données seront en lecture seule et ne pourront plus être modifiées.`}
				loading={archiveMutation.isPending}
			/>
		</div>
	);
}
