"use client";

import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { PageHeader, DataTable, Button, MonthPicker, StatCard } from "@/shared/ui";
import type { Column } from "@/shared/ui";
import { formatCFA, MOIS_LABELS, formatDate } from "@/shared/lib/utils";
import { CreditCard, Receipt } from "lucide-react";

type PaiementRow = Record<string, unknown> & {
	id: string;
	elevePrenom: string;
	eleveNom: string;
	eleveMatricule: string;
	typeFraisNom: string;
	mois: number;
	montant: number;
	datePaiement: string;
	numeroRecu: string;
};

export default function PaiementsPage() {
	const utils = trpc.useUtils();

	const { data: annees = [] } = trpc.academic.annees.list.useQuery();
	const activeAnnee = annees.find((a) => a.active) ?? annees[0];

	const { data: typesFraisList = [] } = trpc.finance.typesFrais.list.useQuery();

	const [selectedMois, setSelectedMois] = useState(new Date().getMonth() + 1);
	const [searchEleve, setSearchEleve] = useState("");
	const [selectedEleveId, setSelectedEleveId] = useState("");
	const [selectedTypeFraisId, setSelectedTypeFraisId] = useState("");
	const [paymentMois, setPaymentMois] = useState(new Date().getMonth() + 1);
	const [montant, setMontant] = useState(0);
	const [lastRecu, setLastRecu] = useState<string | null>(null);

	// Search students by name
	const { data: studentsList = [] } = trpc.students.list.useQuery(
		{
			anneeScolaireId: activeAnnee?.id ?? "",
			search: searchEleve || undefined,
		},
		{ enabled: !!activeAnnee?.id && searchEleve.length >= 2 },
	);

	// List payments for the selected month
	const { data: monthPayments = [] } = trpc.finance.paiements.listByMonth.useQuery(
		{
			anneeScolaireId: activeAnnee?.id ?? "",
			mois: selectedMois,
		},
		{ enabled: !!activeAnnee?.id },
	);

	const createMutation = trpc.finance.paiements.create.useMutation({
		onSuccess: (data) => {
			setLastRecu(data.numeroRecu);
			setSelectedEleveId("");
			setSelectedTypeFraisId("");
			setMontant(0);
			setSearchEleve("");
			utils.finance.paiements.listByMonth.invalidate();
		},
	});

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!activeAnnee || !selectedEleveId || !selectedTypeFraisId || montant <= 0) return;
		createMutation.mutate({
			eleveId: selectedEleveId,
			typeFraisId: selectedTypeFraisId,
			anneeScolaireId: activeAnnee.id,
			mois: paymentMois,
			montant,
		});
	}

	const totalMois = monthPayments.reduce((sum, p) => sum + p.montant, 0);

	const columns: Column<PaiementRow>[] = [
		{ key: "numeroRecu", label: "N° Reçu" },
		{
			key: "eleveNom",
			label: "Élève",
			render: (row) => `${row.elevePrenom} ${row.eleveNom}`,
		},
		{ key: "eleveMatricule", label: "Matricule" },
		{ key: "typeFraisNom", label: "Type de frais" },
		{
			key: "mois",
			label: "Mois",
			render: (row) => MOIS_LABELS[row.mois] ?? String(row.mois),
		},
		{
			key: "montant",
			label: "Montant",
			render: (row) => formatCFA(row.montant),
		},
		{
			key: "datePaiement",
			label: "Date",
			render: (row) => formatDate(row.datePaiement),
		},
	];

	return (
		<div>
			<PageHeader
				title="Paiements"
				breadcrumbs={[
					{ label: "Finances", href: "/finances/bilan" },
					{ label: "Paiements" },
				]}
			/>

			{!activeAnnee && (
				<div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
					Aucune année scolaire active. Veuillez en activer une dans la section Années scolaires.
				</div>
			)}

			{/* Payment form */}
			<div className="mb-6 rounded-xl border bg-surface p-6 shadow-sm">
				<h2 className="mb-4 text-lg font-semibold text-gray-900">Enregistrer un paiement</h2>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label className="mb-1 block text-sm font-medium text-gray-700">
								Rechercher un élève
							</label>
							<input
								type="text"
								placeholder="Tapez le nom de l'élève..."
								value={searchEleve}
								onChange={(e) => {
									setSearchEleve(e.target.value);
									setSelectedEleveId("");
								}}
								className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
							/>
							{searchEleve.length >= 2 && studentsList.length > 0 && !selectedEleveId && (
								<div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-md">
									{studentsList.map((s) => (
										<button
											key={s.id}
											type="button"
											onClick={() => {
												setSelectedEleveId(s.id);
												setSearchEleve(`${s.prenom} ${s.nom} (${s.matricule})`);
											}}
											className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
										>
											{s.prenom} {s.nom} — {s.matricule} ({s.classeNom})
										</button>
									))}
								</div>
							)}
						</div>

						<div>
							<label className="mb-1 block text-sm font-medium text-gray-700">
								Type de frais
							</label>
							<select
								value={selectedTypeFraisId}
								onChange={(e) => setSelectedTypeFraisId(e.target.value)}
								required
								className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
							>
								<option value="">Sélectionner un type</option>
								{typesFraisList.map((tf) => (
									<option key={tf.id} value={tf.id}>
										{tf.nom} ({formatCFA(tf.montantDefaut)})
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="mb-1 block text-sm font-medium text-gray-700">
								Mois
							</label>
							<MonthPicker value={paymentMois} onChange={setPaymentMois} />
						</div>

						<div>
							<label className="mb-1 block text-sm font-medium text-gray-700">
								Montant (FCFA)
							</label>
							<input
								type="number"
								required
								min={1}
								value={montant || ""}
								onChange={(e) => setMontant(parseInt(e.target.value, 10) || 0)}
								className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
							/>
						</div>
					</div>

					<div className="flex items-center gap-4">
						<Button
							type="submit"
							disabled={
								createMutation.isPending ||
								!selectedEleveId ||
								!selectedTypeFraisId ||
								montant <= 0
							}
						>
							<CreditCard className="h-4 w-4" />
							{createMutation.isPending ? "Enregistrement..." : "Enregistrer le paiement"}
						</Button>

						{lastRecu && (
							<div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800">
								<Receipt className="h-4 w-4" />
								Reçu N° {lastRecu} généré avec succès
							</div>
						)}

						{createMutation.isError && (
							<div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
								{createMutation.error.message}
							</div>
						)}
					</div>
				</form>
			</div>

			{/* Stats + month filter */}
			<div className="mb-4 flex flex-wrap items-end gap-4">
				<div>
					<label className="mb-1 block text-sm font-medium text-gray-700">
						Voir les paiements du mois
					</label>
					<MonthPicker value={selectedMois} onChange={setSelectedMois} />
				</div>
				<StatCard
					title={`Total ${MOIS_LABELS[selectedMois]}`}
					value={formatCFA(totalMois)}
					icon={CreditCard}
				/>
			</div>

			{/* Payments table */}
			<DataTable
				columns={columns}
				data={(monthPayments as PaiementRow[]) ?? []}
				searchPlaceholder="Rechercher un paiement..."
			/>
		</div>
	);
}
