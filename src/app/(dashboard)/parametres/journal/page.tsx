"use client";

import { useState } from "react";
import { detailModification } from "@/modules/audit/detail";
import { trpc } from "@/shared/lib/trpc-client";
import { Button, PageHeader } from "@/shared/ui";

const CHAMP =
	"rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const OBJETS = {
	eleve: "Élève",
	contact: "Contact",
	paiement: "Paiement",
	employe: "Employé",
	abonnement: "Abonnement",
	service: "Service",
} as const;
type Objet = keyof typeof OBJETS;

export default function JournalPage() {
	const [entite, setEntite] = useState<Objet | "">("");
	const [du, setDu] = useState("");
	const [au, setAu] = useState("");
	const [page, setPage] = useState(1);
	const journal = trpc.audit.list.useQuery({
		entite: entite || undefined,
		du: du || undefined,
		au: au || undefined,
		page,
	});

	return (
		<div>
			<PageHeader
				title="Journal des modifications"
				breadcrumbs={[{ label: "Paramètres", href: "/parametres" }, { label: "Journal" }]}
			/>
			<div className="mb-4 flex flex-wrap items-end gap-4">
				<div>
					<label htmlFor="journal-objet" className="mb-1 block text-sm font-medium">
						Objet
					</label>
					<select
						id="journal-objet"
						className={CHAMP}
						value={entite}
						onChange={(e) => {
							setEntite(e.target.value as Objet | "");
							setPage(1);
						}}
					>
						<option value="">Tous</option>
						{Object.entries(OBJETS).map(([v, l]) => (
							<option key={v} value={v}>
								{l}
							</option>
						))}
					</select>
				</div>
				<div>
					<label htmlFor="journal-du" className="mb-1 block text-sm font-medium">
						Du
					</label>
					<input
						id="journal-du"
						type="date"
						className={CHAMP}
						value={du}
						onChange={(e) => {
							setDu(e.target.value);
							setPage(1);
						}}
					/>
				</div>
				<div>
					<label htmlFor="journal-au" className="mb-1 block text-sm font-medium">
						Au
					</label>
					<input
						id="journal-au"
						type="date"
						className={CHAMP}
						value={au}
						onChange={(e) => {
							setAu(e.target.value);
							setPage(1);
						}}
					/>
				</div>
			</div>

			{journal.error && <p className="text-sm text-danger">{journal.error.message}</p>}
			<div className="overflow-x-auto rounded-xl bg-surface shadow-sm">
				<table className="w-full text-left text-sm">
					<thead>
						<tr className="border-b text-xs uppercase text-muted">
							<th className="px-4 py-3">Date</th>
							<th className="px-4 py-3">Utilisateur</th>
							<th className="px-4 py-3">Objet</th>
							<th className="px-4 py-3">Action</th>
							<th className="px-4 py-3">Détail</th>
							<th className="px-4 py-3">Motif</th>
						</tr>
					</thead>
					<tbody>
						{journal.data?.lignes.map((l) => (
							<tr key={l.id} className="border-b align-top last:border-0">
								<td className="whitespace-nowrap px-4 py-3">
									{new Date(l.createdAt).toLocaleString("fr-FR", {
										dateStyle: "short",
										timeStyle: "short",
									})}
								</td>
								<td className="px-4 py-3">{l.userNom}</td>
								<td className="px-4 py-3">
									<span className="block text-xs text-muted">
										{OBJETS[l.entite as Objet] ?? l.entite}
									</span>
									{l.libelle}
								</td>
								<td className="px-4 py-3">
									{l.action === "suppression" ? "Suppression" : "Modification"}
								</td>
								<td className="px-4 py-3">
									{detailModification(
										l.avant as Record<string, unknown> | null,
										l.apres as Record<string, unknown> | null,
									).map((d) => (
										<div key={d}>{d}</div>
									))}
								</td>
								<td className="px-4 py-3">{l.motif ?? "—"}</td>
							</tr>
						))}
						{journal.data && journal.data.lignes.length === 0 && (
							<tr>
								<td colSpan={6} className="px-4 py-8 text-center text-muted">
									Aucune modification enregistrée.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
			{journal.data && journal.data.pages > 1 && (
				<div className="mt-4 flex items-center justify-end gap-3 text-sm">
					<Button
						variant="outline"
						size="sm"
						disabled={page <= 1}
						onClick={() => setPage(page - 1)}
					>
						Précédent
					</Button>
					<span>
						Page {page} / {journal.data.pages}
					</span>
					<Button
						variant="outline"
						size="sm"
						disabled={page >= journal.data.pages}
						onClick={() => setPage(page + 1)}
					>
						Suivant
					</Button>
				</div>
			)}
		</div>
	);
}
