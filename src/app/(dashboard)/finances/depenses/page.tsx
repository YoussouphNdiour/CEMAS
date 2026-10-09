"use client";

import { Plus, Receipt } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { formatCFA, formatDate } from "@/shared/lib/utils";
import type { Column } from "@/shared/ui";
import { Button, ConfirmDialog, DataTable, FormModal, PageHeader, StatCard } from "@/shared/ui";

type DepenseRow = {
	id: string;
	categorieId: string;
	libelle: string;
	montant: number;
	date: string;
	note: string | null;
	categorieNom: string;
};

export default function DepensesPage() {
	const [showCreate, setShowCreate] = useState(false);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [form, setForm] = useState({
		categorieId: "",
		libelle: "",
		montant: "",
		date: new Date().toISOString().split("T")[0],
		note: "",
	});

	const utils = trpc.useUtils();
	const { data: annees = [] } = trpc.academic.annees.list.useQuery();
	const activeAnnee = annees.find((a) => a.active) ?? annees[0];

	const depensesList = trpc.finance.depenses.list.useQuery(
		{ anneeScolaireId: activeAnnee?.id ?? "" },
		{ enabled: !!activeAnnee?.id },
	);
	const categories = trpc.finance.depenses.categories.useQuery();

	const createMut = trpc.finance.depenses.create.useMutation({
		onSuccess: () => {
			utils.finance.depenses.list.invalidate();
			resetForm();
			setShowCreate(false);
		},
	});

	const deleteMut = trpc.finance.depenses.delete.useMutation({
		onSuccess: () => {
			utils.finance.depenses.list.invalidate();
			setDeleteId(null);
		},
	});

	function resetForm() {
		setForm({
			categorieId: "",
			libelle: "",
			montant: "",
			date: new Date().toISOString().split("T")[0],
			note: "",
		});
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!activeAnnee) return;
		createMut.mutate({
			categorieId: form.categorieId,
			anneeScolaireId: activeAnnee.id,
			libelle: form.libelle,
			montant: parseInt(form.montant, 10),
			date: form.date,
			note: form.note || undefined,
		});
	}

	const total = (depensesList.data ?? []).reduce((sum, d) => sum + d.montant, 0);

	const columns: Column<DepenseRow>[] = [
		{
			key: "date",
			label: "Date",
			sortable: true,
			render: (row) => formatDate(row.date),
		},
		{ key: "categorieNom", label: "Catégorie", sortable: true },
		{ key: "libelle", label: "Libellé" },
		{
			key: "montant",
			label: "Montant",
			render: (row) => <span className="font-semibold">{formatCFA(row.montant)}</span>,
		},
		{
			key: "note",
			label: "Note",
			render: (row) => row.note || "—",
		},
		{
			key: "id",
			label: "",
			render: (row) => (
				<button
					onClick={(e) => {
						e.stopPropagation();
						setDeleteId(row.id);
					}}
					className="text-xs text-danger hover:underline"
				>
					Supprimer
				</button>
			),
		},
	];

	return (
		<div>
			<PageHeader
				title="Dépenses"
				breadcrumbs={[{ label: "Finances", href: "/finances/paiements" }, { label: "Dépenses" }]}
				action={
					<Button onClick={() => setShowCreate(true)}>
						<Plus className="h-4 w-4" />
						Nouvelle dépense
					</Button>
				}
			/>

			<div className="mb-6">
				<StatCard title="Total des dépenses" value={formatCFA(total)} icon={Receipt} />
			</div>

			<DataTable
				columns={columns}
				data={(depensesList.data as DepenseRow[]) ?? []}
				searchPlaceholder="Rechercher une dépense..."
			/>

			<FormModal
				open={showCreate}
				onClose={() => {
					setShowCreate(false);
					resetForm();
				}}
				title="Nouvelle dépense"
			>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="mb-1 block text-sm font-medium">Catégorie *</label>
						<select
							value={form.categorieId}
							onChange={(e) => setForm({ ...form, categorieId: e.target.value })}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
							required
						>
							<option value="">Sélectionner</option>
							{categories.data?.map((c) => (
								<option key={c.id} value={c.id}>
									{c.nom}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium">Libellé *</label>
						<input
							type="text"
							value={form.libelle}
							onChange={(e) => setForm({ ...form, libelle: e.target.value })}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
							required
						/>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="mb-1 block text-sm font-medium">Montant (FCFA) *</label>
							<input
								type="number"
								value={form.montant}
								onChange={(e) => setForm({ ...form, montant: e.target.value })}
								className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
								required
								min={1}
							/>
						</div>
						<div>
							<label className="mb-1 block text-sm font-medium">Date *</label>
							<input
								type="date"
								value={form.date}
								onChange={(e) => setForm({ ...form, date: e.target.value })}
								className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
								required
							/>
						</div>
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium">Note</label>
						<textarea
							value={form.note}
							onChange={(e) => setForm({ ...form, note: e.target.value })}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
							rows={2}
						/>
					</div>
					<div className="flex justify-end gap-3 pt-2">
						<Button
							variant="ghost"
							type="button"
							onClick={() => {
								setShowCreate(false);
								resetForm();
							}}
						>
							Annuler
						</Button>
						<Button type="submit" disabled={createMut.isPending}>
							{createMut.isPending ? "Enregistrement..." : "Enregistrer"}
						</Button>
					</div>
				</form>
			</FormModal>

			<ConfirmDialog
				open={!!deleteId}
				onClose={() => setDeleteId(null)}
				onConfirm={() => deleteId && deleteMut.mutate({ id: deleteId })}
				title="Supprimer la dépense"
				message="Êtes-vous sûr de vouloir supprimer cette dépense ?"
				loading={deleteMut.isPending}
			/>
		</div>
	);
}
