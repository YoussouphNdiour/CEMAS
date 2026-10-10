"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { formatCFA, MOIS_LABELS } from "@/shared/lib/utils";
import { Button, PageHeader } from "@/shared/ui";

const INPUT =
	"w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
/** Mois de l'échéancier (octobre est inclus dans le forfait d'inscription). */
const MOIS_ECHEANCIER = [11, 12, 1, 2, 3, 4, 5, 6, 7];
const NOV_DEC = [11, 12];
const JANV_MAI = [1, 2, 3, 4, 5];

type Ligne = { libelle: string; montant: string; typeFraisId: string };
type Tarif = {
	niveauId: string;
	niveauNom: string;
	lignes: { libelle: string; montant: number; typeFraisId: string | null }[];
	echeancier: { mois: number; montant: number }[];
};

function CarteNiveau({
	tarif,
	anneeId,
	typesAssociables,
}: {
	tarif: Tarif;
	anneeId: string;
	typesAssociables: { id: string; nom: string }[];
}) {
	const utils = trpc.useUtils();
	const [lignes, setLignes] = useState<Ligne[]>(
		tarif.lignes.map((l) => ({
			libelle: l.libelle,
			montant: String(l.montant),
			typeFraisId: l.typeFraisId ?? "",
		})),
	);
	const [mois, setMois] = useState<Record<number, string>>(
		Object.fromEntries(tarif.echeancier.map((e) => [e.mois, String(e.montant)])),
	);
	const [groupe, setGroupe] = useState({ novDec: "", janvMai: "" });
	const enregistrer = trpc.finance.tarifs.enregistrer.useMutation({
		onSuccess: () => {
			utils.finance.tarifs.list.invalidate();
			utils.finance.impayes.list.invalidate();
			utils.finance.tarifs.pourEleve.invalidate();
			utils.dashboard.stats.invalidate();
		},
	});

	const total = lignes.reduce((t, l) => t + (Number(l.montant) || 0), 0);
	const setLigne = (i: number, patch: Partial<Ligne>) =>
		setLignes(lignes.map((l, j) => (j === i ? { ...l, ...patch } : l)));
	const remplir = (liste: number[], valeur: string) => {
		const suivant = { ...mois };
		for (const m of liste) suivant[m] = valeur;
		setMois(suivant);
	};

	function sauver() {
		enregistrer.mutate({
			anneeScolaireId: anneeId,
			niveauId: tarif.niveauId,
			lignes: lignes
				.filter((l) => l.libelle.trim())
				.map((l) => ({
					libelle: l.libelle.trim(),
					montant: Number(l.montant) || 0,
					typeFraisId: l.typeFraisId || null,
				})),
			echeancier: Object.entries(mois)
				.filter(([, v]) => v !== "")
				.map(([m, v]) => ({ mois: Number(m), montant: Number(v) || 0 })),
		});
	}

	return (
		<section aria-label={tarif.niveauNom} className="rounded-xl bg-surface p-5 shadow-sm">
			<h2 className="mb-4 text-lg font-semibold">{tarif.niveauNom}</h2>
			<div className="grid gap-6 lg:grid-cols-2">
				<div>
					<h3 className="mb-2 text-sm font-medium">Forfait d'inscription</h3>
					<table className="w-full text-sm">
						<thead>
							<tr className="text-left text-xs uppercase text-muted">
								<th className="py-1 pr-2">Libellé</th>
								<th className="py-1 pr-2">Montant</th>
								<th className="py-1 pr-2">Compte aussi les paiements de</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{lignes.map((l, i) => (
								<tr key={`${tarif.niveauId}-${i}`}>
									<td className="py-1 pr-2">
										<input
											aria-label={`Libellé ligne ${i + 1}`}
											className={INPUT}
											value={l.libelle}
											onChange={(e) => setLigne(i, { libelle: e.target.value })}
										/>
									</td>
									<td className="w-32 py-1 pr-2">
										<input
											aria-label={`Montant ligne ${i + 1}`}
											type="number"
											min={0}
											className={`${INPUT} text-right`}
											value={l.montant}
											onChange={(e) => setLigne(i, { montant: e.target.value })}
										/>
									</td>
									<td className="py-1 pr-2">
										<select
											aria-label={`Type associé ligne ${i + 1}`}
											className={INPUT}
											value={l.typeFraisId}
											onChange={(e) => setLigne(i, { typeFraisId: e.target.value })}
										>
											<option value="">—</option>
											{typesAssociables.map((t) => (
												<option key={t.id} value={t.id}>
													{t.nom}
												</option>
											))}
										</select>
									</td>
									<td className="py-1">
										<Button
											type="button"
											variant="ghost"
											size="sm"
											aria-label={`Supprimer ligne ${i + 1}`}
											onClick={() => setLignes(lignes.filter((_, j) => j !== i))}
										>
											<Trash2 className="h-4 w-4 text-red-500" />
										</Button>
									</td>
								</tr>
							))}
						</tbody>
						<tfoot>
							<tr className="border-t font-semibold">
								<td className="py-2">Total</td>
								<td className="py-2 text-right">{formatCFA(total)}</td>
								<td colSpan={2} />
							</tr>
						</tfoot>
					</table>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => setLignes([...lignes, { libelle: "", montant: "", typeFraisId: "" }])}
					>
						<Plus className="h-4 w-4" />
						Ajouter une ligne
					</Button>
				</div>

				<div>
					<h3 className="mb-2 text-sm font-medium">Échéancier des mensualités</h3>
					<p className="mb-2 text-xs text-muted">
						Octobre : inclus dans le forfait d'inscription. Case vide = mois non dû.
					</p>
					<div className="mb-3 flex flex-wrap items-end gap-2 text-xs">
						<input
							aria-label="Montant novembre-décembre"
							type="number"
							min={0}
							placeholder="Nov-déc"
							className={`${INPUT} w-28`}
							value={groupe.novDec}
							onChange={(e) => setGroupe({ ...groupe, novDec: e.target.value })}
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => remplir(NOV_DEC, groupe.novDec)}
						>
							Remplir nov-déc
						</Button>
						<input
							aria-label="Montant janvier-mai"
							type="number"
							min={0}
							placeholder="Janv-mai"
							className={`${INPUT} w-28`}
							value={groupe.janvMai}
							onChange={(e) => setGroupe({ ...groupe, janvMai: e.target.value })}
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => remplir(JANV_MAI, groupe.janvMai)}
						>
							Remplir janv-mai
						</Button>
					</div>
					<div className="grid grid-cols-3 gap-2">
						{MOIS_ECHEANCIER.map((m) => (
							<label key={m} className="text-xs">
								<span className="mb-0.5 block text-muted">{MOIS_LABELS[m]}</span>
								<input
									aria-label={MOIS_LABELS[m]}
									type="number"
									min={0}
									className={`${INPUT} text-right`}
									value={mois[m] ?? ""}
									onChange={(e) => setMois({ ...mois, [m]: e.target.value })}
								/>
							</label>
						))}
					</div>
				</div>
			</div>
			<div className="mt-4 flex items-center gap-3">
				<Button onClick={sauver} disabled={enregistrer.isPending}>
					{enregistrer.isPending ? "Enregistrement..." : "Enregistrer"}
				</Button>
				{enregistrer.isSuccess && (
					<span className="text-sm text-green-700">Tarifs enregistrés</span>
				)}
				{enregistrer.error && (
					<span className="text-sm text-danger">{enregistrer.error.message}</span>
				)}
			</div>
		</section>
	);
}

export default function TarifsPage() {
	const annees = trpc.academic.annees.list.useQuery();
	const annee = annees.data?.find((a) => a.active);
	const tarifs = trpc.finance.tarifs.list.useQuery(
		{ anneeScolaireId: annee?.id ?? "" },
		{ enabled: !!annee },
	);
	const types = trpc.finance.typesFrais.list.useQuery();
	const typesAssociables = (types.data ?? []).filter((t) => !t.obligatoire);

	return (
		<div>
			<PageHeader
				title="Tarifs par niveau"
				breadcrumbs={[
					{ label: "Finances", href: "/finances/paiements" },
					{ label: "Tarifs par niveau" },
				]}
			/>
			<p className="mb-4 text-sm text-muted">
				Forfait d'inscription (total de la fiche, mensualité d'octobre comprise) et mensualités de
				l'année {annee?.libelle ?? ""}. Ces tarifs servent aux impayés, aux relances, au montant
				proposé à la saisie et au détail du reçu.{" "}
				<Link href="/finances/grille" className="underline">
					Grille par classe (ancienne méthode)
				</Link>
			</p>
			{tarifs.isLoading && <p className="text-sm text-muted">Chargement...</p>}
			<div className="space-y-6">
				{annee &&
					tarifs.data?.map((t) => (
						<CarteNiveau
							key={t.niveauId}
							tarif={t}
							anneeId={annee.id}
							typesAssociables={typesAssociables}
						/>
					))}
			</div>
		</div>
	);
}
