"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { etatCapacite, type TonCapacite } from "@/modules/academic/capacite";
import { trpc } from "@/shared/lib/trpc-client";
import type { Column } from "@/shared/ui";
import { Button, ConfirmDialog, DataTable, FormModal, PageHeader } from "@/shared/ui";

type Niveau = {
	id: string;
	nom: string;
	ordre: number;
};

type Classe = Record<string, unknown> & {
	id: string;
	nom: string;
	niveauId: string;
	capacite: number;
	effectif: number;
	classeSuivanteId: string | null;
	finDeCycle: boolean;
	placesRestantes: number;
	anneeScolaireId: string;
	niveau: Niveau;
	createdAt: string | null;
	updatedAt: string | null;
};

const TON_CLASSES: Record<TonCapacite, string> = {
	ok: "bg-green-100 text-green-700",
	alerte: "bg-orange-100 text-orange-700",
	pleine: "bg-red-100 text-red-700",
};

export default function ClassesPage() {
	const utils = trpc.useUtils();

	const { data: niveauxList = [] } = trpc.academic.niveaux.list.useQuery();
	const { data: annees = [] } = trpc.academic.annees.list.useQuery();

	// Get the active year, fallback to first
	const activeAnnee = annees.find((a) => a.active) ?? annees[0];

	const [filterNiveauId, setFilterNiveauId] = useState<string>("");

	const { data: classesList = [], isLoading } = trpc.academic.classes.list.useQuery(
		{
			anneeScolaireId: activeAnnee?.id,
			niveauId: filterNiveauId || undefined,
		},
		{ enabled: !!activeAnnee },
	);
	// Toutes les classes de l'année (non filtrées par niveau) pour la classe suivante
	const { data: toutesClasses = [] } = trpc.academic.classes.list.useQuery(
		{ anneeScolaireId: activeAnnee?.id },
		{ enabled: !!activeAnnee },
	);

	const createMutation = trpc.academic.classes.create.useMutation({
		onSuccess: () => {
			utils.academic.classes.list.invalidate();
			closeModal();
		},
	});

	const updateMutation = trpc.academic.classes.update.useMutation({
		onSuccess: () => {
			utils.academic.classes.list.invalidate();
			closeModal();
		},
	});

	const deleteMutation = trpc.academic.classes.delete.useMutation({
		onSuccess: () => {
			utils.academic.classes.list.invalidate();
			setDeleteTarget(null);
		},
	});

	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<Classe | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<Classe | null>(null);

	// Form state
	const [nom, setNom] = useState("");
	const [niveauId, setNiveauId] = useState("");
	const [capacite, setCapacite] = useState(30);
	const [suivante, setSuivante] = useState("");

	function openCreate() {
		setEditing(null);
		setNom("");
		setNiveauId(niveauxList[0]?.id ?? "");
		setCapacite(30);
		setModalOpen(true);
	}

	function openEdit(classe: Classe) {
		setEditing(classe);
		setNom(classe.nom);
		setNiveauId(classe.niveauId);
		setCapacite(classe.capacite);
		setSuivante(classe.finDeCycle ? "fin" : (classe.classeSuivanteId ?? ""));
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
				capacite,
				finDeCycle: suivante === "fin",
				classeSuivanteId: suivante && suivante !== "fin" ? suivante : null,
			});
		} else {
			if (!activeAnnee) return;
			createMutation.mutate({
				nom,
				niveauId,
				capacite,
				anneeScolaireId: activeAnnee.id,
			});
		}
	}

	const isSaving = createMutation.isPending || updateMutation.isPending;

	const columns: Column<Classe>[] = [
		{ key: "nom", label: "Nom", sortable: true },
		{
			key: "niveau",
			label: "Niveau",
			render: (row) => row.niveau?.nom ?? "-",
		},
		{
			key: "effectif",
			label: "Effectif",
			sortable: true,
			render: (row) => `${row.effectif} / ${row.capacite}`,
		},
		{
			key: "placesRestantes",
			label: "Places restantes",
			sortable: true,
			render: (row) => {
				const etat = etatCapacite(row.effectif, row.capacite);
				return (
					<span className={`rounded px-2 py-0.5 text-xs font-medium ${TON_CLASSES[etat.ton]}`}>
						{etat.libelle}
					</span>
				);
			},
		},
		{
			key: "classeSuivanteId",
			label: "Classe suivante",
			render: (row) =>
				row.finDeCycle ? (
					<span className="text-sm text-muted">Fin de cycle</span>
				) : row.classeSuivanteId ? (
					((toutesClasses as Classe[]).find((c) => c.id === row.classeSuivanteId)?.nom ?? "—")
				) : (
					<span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
						À configurer
					</span>
				),
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
				title="Classes"
				breadcrumbs={[{ label: "Académique" }, { label: "Classes" }]}
				action={
					<Button onClick={openCreate} disabled={!activeAnnee}>
						<Plus className="h-4 w-4" />
						Nouvelle classe
					</Button>
				}
			/>

			{!activeAnnee && (
				<div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
					Aucune année scolaire active. Veuillez en activer une dans la section Années scolaires.
				</div>
			)}

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
				data={classesList as Classe[]}
				searchPlaceholder="Rechercher une classe..."
			/>

			<FormModal
				open={modalOpen}
				onClose={closeModal}
				title={editing ? "Modifier la classe" : "Nouvelle classe"}
			>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
						<input
							type="text"
							value={nom}
							onChange={(e) => setNom(e.target.value)}
							placeholder="Ex: 6ème A"
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
					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">Capacité</label>
						<input
							type="number"
							value={capacite}
							onChange={(e) => setCapacite(Number(e.target.value))}
							min={1}
							required
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>
					{editing && (
						<div>
							<label
								htmlFor="classe-suivante"
								className="mb-1 block text-sm font-medium text-gray-700"
							>
								Classe suivante
							</label>
							<select
								id="classe-suivante"
								value={suivante}
								onChange={(e) => setSuivante(e.target.value)}
								className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
							>
								<option value="">À configurer</option>
								<option value="fin">Fin de cycle (les élèves sortent)</option>
								{(toutesClasses as Classe[])
									.filter((c) => c.id !== editing.id)
									.map((c) => (
										<option key={c.id} value={c.id}>
											{c.nom}
										</option>
									))}
							</select>
						</div>
					)}
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
				title="Supprimer la classe"
				message={`Voulez-vous vraiment supprimer la classe "${deleteTarget?.nom}" ? Cette action est irréversible.`}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
