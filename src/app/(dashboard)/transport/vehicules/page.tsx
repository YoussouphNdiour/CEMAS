"use client";

import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { Button, PageHeader, DataTable, FormModal, ConfirmDialog } from "@/shared/ui";
import type { Column } from "@/shared/ui";
import { Plus, Pencil, Trash2 } from "lucide-react";

type VehiculeRow = Record<string, unknown> & {
	id: string;
	immatriculation: string;
	marque: string | null;
	capacite: number;
	chauffeurNom: string;
	chauffeurTel: string;
};

type FormData = {
	immatriculation: string;
	marque: string;
	capacite: number;
	chauffeurNom: string;
	chauffeurTel: string;
};

const emptyForm: FormData = {
	immatriculation: "",
	marque: "",
	capacite: 0,
	chauffeurNom: "",
	chauffeurTel: "",
};

export default function VehiculesPage() {
	const utils = trpc.useUtils();

	const { data: vehiculesList = [], isLoading } = trpc.transport.vehicules.list.useQuery();

	const createMutation = trpc.transport.vehicules.create.useMutation({
		onSuccess: () => {
			utils.transport.vehicules.list.invalidate();
			closeModal();
		},
	});

	const updateMutation = trpc.transport.vehicules.update.useMutation({
		onSuccess: () => {
			utils.transport.vehicules.list.invalidate();
			closeModal();
		},
	});

	const deleteMutation = trpc.transport.vehicules.delete.useMutation({
		onSuccess: () => {
			utils.transport.vehicules.list.invalidate();
			setDeleteTarget(null);
		},
	});

	const [modalOpen, setModalOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<FormData>(emptyForm);
	const [deleteTarget, setDeleteTarget] = useState<VehiculeRow | null>(null);

	function openCreate() {
		setEditingId(null);
		setForm(emptyForm);
		setModalOpen(true);
	}

	function openEdit(row: VehiculeRow) {
		setEditingId(row.id);
		setForm({
			immatriculation: row.immatriculation,
			marque: row.marque ?? "",
			capacite: row.capacite,
			chauffeurNom: row.chauffeurNom,
			chauffeurTel: row.chauffeurTel,
		});
		setModalOpen(true);
	}

	function closeModal() {
		setModalOpen(false);
		setEditingId(null);
		setForm(emptyForm);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (editingId) {
			updateMutation.mutate({
				id: editingId,
				immatriculation: form.immatriculation,
				marque: form.marque || undefined,
				capacite: form.capacite,
				chauffeurNom: form.chauffeurNom,
				chauffeurTel: form.chauffeurTel,
			});
		} else {
			createMutation.mutate({
				immatriculation: form.immatriculation,
				marque: form.marque || undefined,
				capacite: form.capacite,
				chauffeurNom: form.chauffeurNom,
				chauffeurTel: form.chauffeurTel,
			});
		}
	}

	const isSaving = createMutation.isPending || updateMutation.isPending;

	const columns: Column<VehiculeRow>[] = [
		{ key: "immatriculation", label: "Immatriculation", sortable: true },
		{
			key: "marque",
			label: "Marque",
			sortable: true,
			render: (row) => row.marque ?? "-",
		},
		{ key: "capacite", label: "Capacité", sortable: true },
		{ key: "chauffeurNom", label: "Chauffeur", sortable: true },
		{ key: "chauffeurTel", label: "Téléphone" },
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
				title="Véhicules"
				breadcrumbs={[
					{ label: "Transport" },
					{ label: "Véhicules" },
				]}
				action={
					<Button onClick={openCreate}>
						<Plus className="h-4 w-4" />
						Nouveau véhicule
					</Button>
				}
			/>

			<DataTable
				columns={columns}
				data={vehiculesList as VehiculeRow[]}
				searchPlaceholder="Rechercher un véhicule..."
			/>

			<FormModal
				open={modalOpen}
				onClose={closeModal}
				title={editingId ? "Modifier le véhicule" : "Nouveau véhicule"}
			>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">
							Immatriculation
						</label>
						<input
							type="text"
							required
							value={form.immatriculation}
							onChange={(e) => setForm({ ...form, immatriculation: e.target.value })}
							placeholder="Ex: DK-1234-AB"
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>

					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">
							Marque
						</label>
						<input
							type="text"
							value={form.marque}
							onChange={(e) => setForm({ ...form, marque: e.target.value })}
							placeholder="Ex: Toyota Coaster"
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>

					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">
							Capacité
						</label>
						<input
							type="number"
							required
							min={1}
							value={form.capacite || ""}
							onChange={(e) => setForm({ ...form, capacite: parseInt(e.target.value, 10) || 0 })}
							placeholder="Nombre de places"
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>

					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">
							Nom du chauffeur
						</label>
						<input
							type="text"
							required
							value={form.chauffeurNom}
							onChange={(e) => setForm({ ...form, chauffeurNom: e.target.value })}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>

					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">
							Téléphone du chauffeur
						</label>
						<input
							type="text"
							required
							value={form.chauffeurTel}
							onChange={(e) => setForm({ ...form, chauffeurTel: e.target.value })}
							placeholder="Ex: 77 123 45 67"
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>

					<div className="flex items-center justify-end gap-3 pt-2">
						<Button variant="ghost" type="button" onClick={closeModal}>
							Annuler
						</Button>
						<Button type="submit" disabled={isSaving}>
							{isSaving ? "Enregistrement..." : editingId ? "Modifier" : "Créer"}
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
				title="Supprimer le véhicule"
				message={
					deleteTarget
						? `Voulez-vous vraiment supprimer le véhicule "${deleteTarget.immatriculation}" ? Cette action est irréversible.`
						: ""
				}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
