"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/shared/lib/trpc-client";
import { PageHeader, DataTable, StatusBadge, Button } from "@/shared/ui";
import type { Column } from "@/shared/ui";
import { Plus } from "lucide-react";

// TODO: get active year from context/query — hardcoded for now
const PLACEHOLDER_ANNEE_ID = "";

type StudentRow = {
	id: string;
	matricule: string;
	prenom: string;
	nom: string;
	sexe: string;
	statut: string;
	classeNom: string;
	niveauNom: string;
	niveauId: string;
};

export default function ElevesPage() {
	const router = useRouter();
	const [niveauFilter, setNiveauFilter] = useState("");
	const [classeFilter, setClasseFilter] = useState("");
	const [statutFilter, setStatutFilter] = useState("");
	const [search, setSearch] = useState("");

	const niveaux = trpc.academic.niveaux.list.useQuery();
	const annees = trpc.academic.annees.list.useQuery();
	const activeAnnee = annees.data?.find((a) => a.active);

	const students = trpc.students.list.useQuery(
		{
			anneeScolaireId: activeAnnee?.id ?? PLACEHOLDER_ANNEE_ID,
			niveauId: niveauFilter || undefined,
			classeId: classeFilter || undefined,
			statut: statutFilter || undefined,
			search: search || undefined,
		},
		{ enabled: !!activeAnnee?.id },
	);

	const columns: Column<StudentRow>[] = [
		{ key: "matricule", label: "Matricule" },
		{
			key: "nom",
			label: "Nom complet",
			render: (row) => `${row.prenom} ${row.nom}`,
		},
		{ key: "classeNom", label: "Classe" },
		{ key: "niveauNom", label: "Niveau" },
		{ key: "sexe", label: "Sexe" },
		{
			key: "statut",
			label: "Statut",
			render: (row) => <StatusBadge status={row.statut} />,
		},
	];

	return (
		<div>
			<PageHeader
				title="Élèves"
				breadcrumbs={[{ label: "Élèves" }]}
				action={
					<Button onClick={() => router.push("/eleves/nouveau")}>
						<Plus className="h-4 w-4" />
						Nouvelle inscription
					</Button>
				}
			/>

			<div className="mb-4 flex flex-wrap gap-3">
				<select
					value={niveauFilter}
					onChange={(e) => setNiveauFilter(e.target.value)}
					className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
				>
					<option value="">Tous les niveaux</option>
					{niveaux.data?.map((n) => (
						<option key={n.id} value={n.id}>
							{n.nom}
						</option>
					))}
				</select>
				<select
					value={statutFilter}
					onChange={(e) => setStatutFilter(e.target.value)}
					className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
				>
					<option value="">Tous les statuts</option>
					<option value="actif">Actif</option>
					<option value="inactif">Inactif</option>
					<option value="transfere">Transféré</option>
				</select>
				<input
					type="text"
					placeholder="Rechercher un élève..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
				/>
			</div>

			<DataTable
				columns={columns}
				data={(students.data as StudentRow[]) ?? []}
				searchPlaceholder="Rechercher par nom ou matricule..."
				onRowClick={(row) => router.push(`/eleves/${row.id}`)}
			/>
		</div>
	);
}
