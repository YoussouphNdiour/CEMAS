"use client";

import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { Button, PageHeader, DataTable, FormModal, ConfirmDialog } from "@/shared/ui";
import type { Column } from "@/shared/ui";
import { Plus, Pencil, Trash2, MapPin, ChevronDown, ChevronUp } from "lucide-react";

type ItineraireRow = Record<string, unknown> & {
	id: string;
	nom: string;
	vehiculeId: string | null;
	description: string | null;
	vehiculeImmatriculation: string | null;
	vehiculeMarque: string | null;
	arretsCount: number;
};

type ArretRow = {
	id: string;
	itineraireId: string;
	nom: string;
	ordre: number;
	heurePassage: string | null;
};

type ItineraireFormData = {
	nom: string;
	vehiculeId: string;
	description: string;
};

type ArretFormData = {
	nom: string;
	ordre: number;
	heurePassage: string;
};

const emptyItineraireForm: ItineraireFormData = {
	nom: "",
	vehiculeId: "",
	description: "",
};

const emptyArretForm: ArretFormData = {
	nom: "",
	ordre: 1,
	heurePassage: "",
};

export default function ItinerairesPage() {
	const utils = trpc.useUtils();

	const { data: itinerairesList = [], isLoading } = trpc.transport.itineraires.list.useQuery();
	const { data: vehiculesList = [] } = trpc.transport.vehicules.list.useQuery();

	// Itineraire CRUD
	const createItineraireMutation = trpc.transport.itineraires.create.useMutation({
		onSuccess: () => {
			utils.transport.itineraires.list.invalidate();
			closeItineraireModal();
		},
	});

	const updateItineraireMutation = trpc.transport.itineraires.update.useMutation({
		onSuccess: () => {
			utils.transport.itineraires.list.invalidate();
			closeItineraireModal();
		},
	});

	const deleteItineraireMutation = trpc.transport.itineraires.delete.useMutation({
		onSuccess: () => {
			utils.transport.itineraires.list.invalidate();
			setDeleteItineraireTarget(null);
			if (selectedItineraireId) setSelectedItineraireId(null);
		},
	});

	// Arrets CRUD
	const createArretMutation = trpc.transport.arrets.create.useMutation({
		onSuccess: () => {
			utils.transport.arrets.listByItineraire.invalidate();
			utils.transport.itineraires.list.invalidate();
			closeArretModal();
		},
	});

	const deleteArretMutation = trpc.transport.arrets.delete.useMutation({
		onSuccess: () => {
			utils.transport.arrets.listByItineraire.invalidate();
			utils.transport.itineraires.list.invalidate();
			setDeleteArretTarget(null);
		},
	});

	// Itineraire state
	const [itineraireModalOpen, setItineraireModalOpen] = useState(false);
	const [editingItineraireId, setEditingItineraireId] = useState<string | null>(null);
	const [itineraireForm, setItineraireForm] = useState<ItineraireFormData>(emptyItineraireForm);
	const [deleteItineraireTarget, setDeleteItineraireTarget] = useState<ItineraireRow | null>(null);

	// Selected itineraire for arrets sub-section
	const [selectedItineraireId, setSelectedItineraireId] = useState<string | null>(null);

	// Arret state
	const [arretModalOpen, setArretModalOpen] = useState(false);
	const [arretForm, setArretForm] = useState<ArretFormData>(emptyArretForm);
	const [deleteArretTarget, setDeleteArretTarget] = useState<ArretRow | null>(null);

	// Arrets query for selected itineraire
	const { data: arretsList = [] } = trpc.transport.arrets.listByItineraire.useQuery(
		{ itineraireId: selectedItineraireId! },
		{ enabled: !!selectedItineraireId },
	);

	// Itineraire handlers
	function openCreateItineraire() {
		setEditingItineraireId(null);
		setItineraireForm(emptyItineraireForm);
		setItineraireModalOpen(true);
	}

	function openEditItineraire(row: ItineraireRow) {
		setEditingItineraireId(row.id);
		setItineraireForm({
			nom: row.nom,
			vehiculeId: row.vehiculeId ?? "",
			description: row.description ?? "",
		});
		setItineraireModalOpen(true);
	}

	function closeItineraireModal() {
		setItineraireModalOpen(false);
		setEditingItineraireId(null);
		setItineraireForm(emptyItineraireForm);
	}

	function handleItineraireSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (editingItineraireId) {
			updateItineraireMutation.mutate({
				id: editingItineraireId,
				nom: itineraireForm.nom,
				vehiculeId: itineraireForm.vehiculeId || null,
				description: itineraireForm.description || undefined,
			});
		} else {
			createItineraireMutation.mutate({
				nom: itineraireForm.nom,
				vehiculeId: itineraireForm.vehiculeId || undefined,
				description: itineraireForm.description || undefined,
			});
		}
	}

	// Arret handlers
	function openCreateArret() {
		const nextOrdre = arretsList.length > 0 ? Math.max(...arretsList.map((a) => a.ordre)) + 1 : 1;
		setArretForm({ ...emptyArretForm, ordre: nextOrdre });
		setArretModalOpen(true);
	}

	function closeArretModal() {
		setArretModalOpen(false);
		setArretForm(emptyArretForm);
	}

	function handleArretSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!selectedItineraireId) return;
		createArretMutation.mutate({
			itineraireId: selectedItineraireId,
			nom: arretForm.nom,
			ordre: arretForm.ordre,
			heurePassage: arretForm.heurePassage || undefined,
		});
	}

	function toggleItineraire(id: string) {
		setSelectedItineraireId((prev) => (prev === id ? null : id));
	}

	const isSavingItineraire = createItineraireMutation.isPending || updateItineraireMutation.isPending;

	const selectedItineraire = itinerairesList.find((i) => i.id === selectedItineraireId);

	const columns: Column<ItineraireRow>[] = [
		{ key: "nom", label: "Nom", sortable: true },
		{
			key: "vehiculeImmatriculation",
			label: "Véhicule",
			render: (row) =>
				row.vehiculeImmatriculation
					? `${row.vehiculeImmatriculation}${row.vehiculeMarque ? ` (${row.vehiculeMarque})` : ""}`
					: "-",
		},
		{
			key: "arretsCount",
			label: "Nb arrêts",
			sortable: true,
		},
		{
			key: "description",
			label: "Description",
			render: (row) => row.description ?? "-",
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
							toggleItineraire(row.id);
						}}
						title="Voir les arrêts"
					>
						{selectedItineraireId === row.id ? (
							<ChevronUp className="h-4 w-4" />
						) : (
							<ChevronDown className="h-4 w-4" />
						)}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={(e) => {
							e.stopPropagation();
							openEditItineraire(row);
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
							setDeleteItineraireTarget(row);
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
				title="Itinéraires"
				breadcrumbs={[
					{ label: "Transport" },
					{ label: "Itinéraires" },
				]}
				action={
					<Button onClick={openCreateItineraire}>
						<Plus className="h-4 w-4" />
						Nouvel itinéraire
					</Button>
				}
			/>

			<DataTable
				columns={columns}
				data={itinerairesList as ItineraireRow[]}
				searchPlaceholder="Rechercher un itinéraire..."
				onRowClick={(row) => toggleItineraire(row.id)}
			/>

			{/* Arrets sub-section for selected itineraire */}
			{selectedItineraireId && selectedItineraire && (
				<div className="mt-4 rounded-xl border bg-surface p-4 shadow-sm">
					<div className="mb-4 flex items-center justify-between">
						<h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
							<MapPin className="h-4 w-4" />
							Arrêts de &laquo; {selectedItineraire.nom} &raquo;
						</h3>
						<Button size="sm" onClick={openCreateArret}>
							<Plus className="h-4 w-4" />
							Ajouter un arrêt
						</Button>
					</div>

					{arretsList.length === 0 ? (
						<p className="py-4 text-center text-sm text-muted">
							Aucun arrêt pour cet itinéraire.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-left text-sm">
								<thead>
									<tr className="border-b bg-gray-50">
										<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
											Ordre
										</th>
										<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
											Nom
										</th>
										<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
											Heure de passage
										</th>
										<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
											Actions
										</th>
									</tr>
								</thead>
								<tbody>
									{arretsList.map((arret) => (
										<tr key={arret.id} className="border-b last:border-b-0">
											<td className="whitespace-nowrap px-4 py-3 font-medium">
												{arret.ordre}
											</td>
											<td className="whitespace-nowrap px-4 py-3">{arret.nom}</td>
											<td className="whitespace-nowrap px-4 py-3">
												{arret.heurePassage ?? "-"}
											</td>
											<td className="whitespace-nowrap px-4 py-3">
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setDeleteArretTarget(arret)}
													title="Supprimer"
												>
													<Trash2 className="h-4 w-4 text-red-500" />
												</Button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			)}

			{/* Itineraire create/edit modal */}
			<FormModal
				open={itineraireModalOpen}
				onClose={closeItineraireModal}
				title={editingItineraireId ? "Modifier l'itinéraire" : "Nouvel itinéraire"}
			>
				<form onSubmit={handleItineraireSubmit} className="space-y-4">
					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">
							Nom
						</label>
						<input
							type="text"
							required
							value={itineraireForm.nom}
							onChange={(e) => setItineraireForm({ ...itineraireForm, nom: e.target.value })}
							placeholder="Ex: Parcelles Assainies → École"
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>

					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">
							Véhicule
						</label>
						<select
							value={itineraireForm.vehiculeId}
							onChange={(e) => setItineraireForm({ ...itineraireForm, vehiculeId: e.target.value })}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						>
							<option value="">Aucun véhicule</option>
							{vehiculesList.map((v) => (
								<option key={v.id} value={v.id}>
									{v.immatriculation}{v.marque ? ` (${v.marque})` : ""}
								</option>
							))}
						</select>
					</div>

					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">
							Description
						</label>
						<textarea
							value={itineraireForm.description}
							onChange={(e) => setItineraireForm({ ...itineraireForm, description: e.target.value })}
							rows={3}
							placeholder="Description optionnelle..."
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>

					<div className="flex items-center justify-end gap-3 pt-2">
						<Button variant="ghost" type="button" onClick={closeItineraireModal}>
							Annuler
						</Button>
						<Button type="submit" disabled={isSavingItineraire}>
							{isSavingItineraire ? "Enregistrement..." : editingItineraireId ? "Modifier" : "Créer"}
						</Button>
					</div>
				</form>
			</FormModal>

			{/* Arret create modal */}
			<FormModal
				open={arretModalOpen}
				onClose={closeArretModal}
				title="Nouvel arrêt"
			>
				<form onSubmit={handleArretSubmit} className="space-y-4">
					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">
							Nom
						</label>
						<input
							type="text"
							required
							value={arretForm.nom}
							onChange={(e) => setArretForm({ ...arretForm, nom: e.target.value })}
							placeholder="Ex: Arrêt marché Sandaga"
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>

					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">
							Ordre
						</label>
						<input
							type="number"
							required
							min={1}
							value={arretForm.ordre}
							onChange={(e) => setArretForm({ ...arretForm, ordre: parseInt(e.target.value, 10) || 1 })}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>

					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">
							Heure de passage
						</label>
						<input
							type="time"
							value={arretForm.heurePassage}
							onChange={(e) => setArretForm({ ...arretForm, heurePassage: e.target.value })}
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>

					<div className="flex items-center justify-end gap-3 pt-2">
						<Button variant="ghost" type="button" onClick={closeArretModal}>
							Annuler
						</Button>
						<Button type="submit" disabled={createArretMutation.isPending}>
							{createArretMutation.isPending ? "Enregistrement..." : "Créer"}
						</Button>
					</div>
				</form>
			</FormModal>

			{/* Delete itineraire confirm */}
			<ConfirmDialog
				open={!!deleteItineraireTarget}
				onClose={() => setDeleteItineraireTarget(null)}
				onConfirm={() => {
					if (deleteItineraireTarget) deleteItineraireMutation.mutate({ id: deleteItineraireTarget.id });
				}}
				title="Supprimer l'itinéraire"
				message={
					deleteItineraireTarget
						? `Voulez-vous vraiment supprimer l'itinéraire "${deleteItineraireTarget.nom}" et tous ses arrêts ? Cette action est irréversible.`
						: ""
				}
				loading={deleteItineraireMutation.isPending}
			/>

			{/* Delete arret confirm */}
			<ConfirmDialog
				open={!!deleteArretTarget}
				onClose={() => setDeleteArretTarget(null)}
				onConfirm={() => {
					if (deleteArretTarget) deleteArretMutation.mutate({ id: deleteArretTarget.id });
				}}
				title="Supprimer l'arrêt"
				message={
					deleteArretTarget
						? `Voulez-vous vraiment supprimer l'arrêt "${deleteArretTarget.nom}" ? Cette action est irréversible.`
						: ""
				}
				loading={deleteArretMutation.isPending}
			/>
		</div>
	);
}
