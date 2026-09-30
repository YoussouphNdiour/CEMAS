"use client";

import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { PageHeader, DataTable, StatusBadge, Button, FormModal, ConfirmDialog } from "@/shared/ui";
import type { Column } from "@/shared/ui";
import { formatCFA } from "@/shared/lib/utils";
import { Plus, Pencil, Trash2 } from "lucide-react";

type EmployeRow = {
	id: string;
	matricule: string;
	prenom: string;
	nom: string;
	telephone: string | null;
	poste: string;
	type: string;
	salaireBase: number;
	dateEmbauche: string;
	statut: string;
	bulletinsCount: number;
};

type FormData = {
	prenom: string;
	nom: string;
	telephone: string;
	poste: string;
	type: "enseignant" | "administratif" | "entretien";
	salaireBase: number;
	dateEmbauche: string;
};

const emptyForm: FormData = {
	prenom: "",
	nom: "",
	telephone: "",
	poste: "",
	type: "enseignant",
	salaireBase: 0,
	dateEmbauche: "",
};

export default function EmployesPage() {
	const [modalOpen, setModalOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<FormData>(emptyForm);
	const [deleteTarget, setDeleteTarget] = useState<EmployeRow | null>(null);

	const utils = trpc.useUtils();
	const employesQuery = trpc.payroll.employes.list.useQuery();

	const createMutation = trpc.payroll.employes.create.useMutation({
		onSuccess: () => {
			utils.payroll.employes.list.invalidate();
			closeModal();
		},
	});

	const updateMutation = trpc.payroll.employes.update.useMutation({
		onSuccess: () => {
			utils.payroll.employes.list.invalidate();
			closeModal();
		},
	});

	const deleteMutation = trpc.payroll.employes.delete.useMutation({
		onSuccess: () => {
			utils.payroll.employes.list.invalidate();
			setDeleteTarget(null);
		},
	});

	function openCreate() {
		setEditingId(null);
		setForm(emptyForm);
		setModalOpen(true);
	}

	function openEdit(row: EmployeRow) {
		setEditingId(row.id);
		setForm({
			prenom: row.prenom,
			nom: row.nom,
			telephone: row.telephone ?? "",
			poste: row.poste,
			type: row.type as FormData["type"],
			salaireBase: row.salaireBase,
			dateEmbauche: row.dateEmbauche,
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
				prenom: form.prenom,
				nom: form.nom,
				telephone: form.telephone || undefined,
				poste: form.poste,
				type: form.type,
				salaireBase: form.salaireBase,
				dateEmbauche: form.dateEmbauche,
			});
		} else {
			createMutation.mutate({
				prenom: form.prenom,
				nom: form.nom,
				telephone: form.telephone || undefined,
				poste: form.poste,
				type: form.type,
				salaireBase: form.salaireBase,
				dateEmbauche: form.dateEmbauche,
			});
		}
	}

	const isSaving = createMutation.isPending || updateMutation.isPending;

	const columns: Column<EmployeRow>[] = [
		{ key: "matricule", label: "Matricule", sortable: true },
		{
			key: "nom",
			label: "Nom complet",
			sortable: true,
			render: (row) => `${row.prenom} ${row.nom}`,
		},
		{ key: "poste", label: "Poste", sortable: true },
		{
			key: "type",
			label: "Type",
			render: (row) => <StatusBadge status={row.type} />,
		},
		{
			key: "salaireBase",
			label: "Salaire base",
			render: (row) => formatCFA(row.salaireBase),
		},
		{
			key: "statut",
			label: "Statut",
			render: (row) => <StatusBadge status={row.statut} />,
		},
		{
			key: "actions",
			label: "Actions",
			render: (row) => (
				<div className="flex items-center gap-2">
					<button
						onClick={(e) => {
							e.stopPropagation();
							openEdit(row);
						}}
						className="rounded-lg p-1.5 text-muted transition hover:bg-gray-100 hover:text-gray-900"
						title="Modifier"
					>
						<Pencil className="h-4 w-4" />
					</button>
					<button
						onClick={(e) => {
							e.stopPropagation();
							setDeleteTarget(row);
						}}
						className="rounded-lg p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600"
						title="Supprimer"
					>
						<Trash2 className="h-4 w-4" />
					</button>
				</div>
			),
		},
	];

	return (
		<div>
			<PageHeader
				title="Employes"
				breadcrumbs={[{ label: "Paie", href: "/payroll/bulletins" }, { label: "Employes" }]}
				action={
					<Button onClick={openCreate}>
						<Plus className="h-4 w-4" />
						Nouvel employe
					</Button>
				}
			/>

			<DataTable
				columns={columns}
				data={(employesQuery.data as EmployeRow[]) ?? []}
				searchPlaceholder="Rechercher un employe..."
			/>

			<FormModal
				open={modalOpen}
				onClose={closeModal}
				title={editingId ? "Modifier l'employe" : "Nouvel employe"}
			>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="mb-1 block text-sm font-medium text-gray-700">
								Prenom
							</label>
							<input
								type="text"
								required
								value={form.prenom}
								onChange={(e) => setForm({ ...form, prenom: e.target.value })}
								className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>
						<div>
							<label className="mb-1 block text-sm font-medium text-gray-700">
								Nom
							</label>
							<input
								type="text"
								required
								value={form.nom}
								onChange={(e) => setForm({ ...form, nom: e.target.value })}
								className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>
					</div>

					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">
							Telephone
						</label>
						<input
							type="text"
							value={form.telephone}
							onChange={(e) => setForm({ ...form, telephone: e.target.value })}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">
							Poste
						</label>
						<input
							type="text"
							required
							value={form.poste}
							onChange={(e) => setForm({ ...form, poste: e.target.value })}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">
							Type
						</label>
						<select
							value={form.type}
							onChange={(e) => setForm({ ...form, type: e.target.value as FormData["type"] })}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						>
							<option value="enseignant">Enseignant</option>
							<option value="administratif">Administratif</option>
							<option value="entretien">Entretien</option>
						</select>
					</div>

					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">
							Salaire de base (FCFA)
						</label>
						<input
							type="number"
							required
							min={1}
							value={form.salaireBase || ""}
							onChange={(e) => setForm({ ...form, salaireBase: parseInt(e.target.value, 10) || 0 })}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">
							Date d'embauche
						</label>
						<input
							type="date"
							required
							value={form.dateEmbauche}
							onChange={(e) => setForm({ ...form, dateEmbauche: e.target.value })}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div className="flex items-center justify-end gap-3 pt-2">
						<Button variant="ghost" type="button" onClick={closeModal}>
							Annuler
						</Button>
						<Button type="submit" disabled={isSaving}>
							{isSaving ? "Enregistrement..." : editingId ? "Modifier" : "Creer"}
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
				title="Supprimer l'employe"
				message={
					deleteTarget
						? `Voulez-vous vraiment supprimer ${deleteTarget.prenom} ${deleteTarget.nom} ? Cette action est irreversible.`
						: ""
				}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
