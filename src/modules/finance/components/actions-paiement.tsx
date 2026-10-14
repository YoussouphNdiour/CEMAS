"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { formatCFA, MOIS_LABELS } from "@/shared/lib/utils";
import { Button, FormModal } from "@/shared/ui";

const CHAMP =
	"w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const MOIS_SCOLAIRES = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export interface PaiementModifiable {
	id: string;
	numeroRecu: string;
	typeFraisId: string;
	mois: number;
	montant: number;
	datePaiement: string;
	libelleEleve: string;
}

/** Boutons Modifier / Supprimer d'un paiement (administrateur), motif obligatoire. */
export function ActionsPaiement({ paiement }: { paiement: PaiementModifiable }) {
	const utils = trpc.useUtils();
	const types = trpc.finance.typesFrais.list.useQuery();
	const [edition, setEdition] = useState<(PaiementModifiable & { motif: string }) | null>(null);
	const [suppression, setSuppression] = useState<string | null>(null);

	const rafraichir = () => {
		utils.finance.paiements.listByMonth.invalidate();
		utils.finance.paiements.listByEleve.invalidate();
		utils.finance.impayes.list.invalidate();
		utils.finance.tarifs.pourEleve.invalidate();
		utils.dashboard.stats.invalidate();
	};
	const modifier = trpc.finance.paiements.update.useMutation({
		onSuccess: () => {
			setEdition(null);
			rafraichir();
		},
	});
	const supprimer = trpc.finance.paiements.delete.useMutation({
		onSuccess: () => {
			setSuppression(null);
			rafraichir();
		},
	});

	return (
		<div className="flex items-center gap-1">
			<button
				type="button"
				aria-label="Modifier le paiement"
				title="Modifier le paiement"
				className="rounded p-1 text-primary hover:bg-primary/10"
				onClick={(e) => {
					e.stopPropagation();
					modifier.reset();
					setEdition({ ...paiement, motif: "" });
				}}
			>
				<Pencil className="h-4 w-4" />
			</button>
			<button
				type="button"
				aria-label="Supprimer le paiement"
				title="Supprimer le paiement"
				className="rounded p-1 text-red-500 hover:bg-red-50"
				onClick={(e) => {
					e.stopPropagation();
					supprimer.reset();
					setSuppression("");
				}}
			>
				<Trash2 className="h-4 w-4" />
			</button>

			<FormModal
				open={edition !== null}
				onClose={() => setEdition(null)}
				title={`Modifier le reçu ${paiement.numeroRecu}`}
			>
				{edition && (
					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							modifier.mutate({
								id: edition.id,
								typeFraisId: edition.typeFraisId,
								mois: edition.mois,
								montant: edition.montant,
								datePaiement: edition.datePaiement,
								motif: edition.motif,
							});
						}}
					>
						<p className="text-sm text-muted">{paiement.libelleEleve}</p>
						<div className="grid grid-cols-2 gap-4">
							<Champ id="paiement-edit-type" label="Type de frais">
								<select
									id="paiement-edit-type"
									className={CHAMP}
									value={edition.typeFraisId}
									onChange={(e) => setEdition({ ...edition, typeFraisId: e.target.value })}
								>
									{types.data?.map((t) => (
										<option key={t.id} value={t.id}>
											{t.nom}
										</option>
									))}
								</select>
							</Champ>
							<Champ id="paiement-edit-mois" label="Mois">
								<select
									id="paiement-edit-mois"
									className={CHAMP}
									value={edition.mois}
									onChange={(e) => setEdition({ ...edition, mois: Number(e.target.value) })}
								>
									{MOIS_SCOLAIRES.map((m) => (
										<option key={m} value={m}>
											{MOIS_LABELS[m]}
										</option>
									))}
								</select>
							</Champ>
							<Champ id="paiement-edit-montant" label="Montant (FCFA)">
								<input
									id="paiement-edit-montant"
									type="number"
									min={1}
									className={CHAMP}
									value={edition.montant || ""}
									onChange={(e) =>
										setEdition({ ...edition, montant: Number.parseInt(e.target.value, 10) || 0 })
									}
								/>
							</Champ>
							<Champ id="paiement-edit-date" label="Date du paiement">
								<input
									id="paiement-edit-date"
									type="date"
									className={CHAMP}
									value={edition.datePaiement}
									onChange={(e) => setEdition({ ...edition, datePaiement: e.target.value })}
								/>
							</Champ>
						</div>
						<Champ id="paiement-edit-motif" label="Motif *">
							<input
								id="paiement-edit-motif"
								className={CHAMP}
								maxLength={300}
								placeholder="Ex. montant saisi par erreur"
								value={edition.motif}
								onChange={(e) => setEdition({ ...edition, motif: e.target.value })}
							/>
						</Champ>
						{modifier.error && <p className="text-sm text-danger">{modifier.error.message}</p>}
						<div className="flex justify-end gap-2">
							<Button type="button" variant="ghost" onClick={() => setEdition(null)}>
								Annuler
							</Button>
							<Button
								type="submit"
								disabled={modifier.isPending || !edition.motif.trim() || edition.montant <= 0}
							>
								{modifier.isPending ? "Enregistrement..." : "Enregistrer"}
							</Button>
						</div>
					</form>
				)}
			</FormModal>

			<FormModal
				open={suppression !== null}
				onClose={() => setSuppression(null)}
				title={`Supprimer le reçu ${paiement.numeroRecu} ?`}
			>
				{suppression !== null && (
					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							supprimer.mutate({ id: paiement.id, motif: suppression });
						}}
					>
						<p className="text-sm">
							{paiement.libelleEleve} —{" "}
							{types.data?.find((t) => t.id === paiement.typeFraisId)?.nom}{" "}
							{MOIS_LABELS[paiement.mois]} — {formatCFA(paiement.montant)}. La suppression est
							définitive ; le numéro de reçu ne sera pas réutilisé.
						</p>
						<Champ id="paiement-suppr-motif" label="Motif *">
							<input
								id="paiement-suppr-motif"
								className={CHAMP}
								maxLength={300}
								value={suppression}
								onChange={(e) => setSuppression(e.target.value)}
							/>
						</Champ>
						{supprimer.error && <p className="text-sm text-danger">{supprimer.error.message}</p>}
						<div className="flex justify-end gap-2">
							<Button type="button" variant="ghost" onClick={() => setSuppression(null)}>
								Annuler
							</Button>
							<Button
								type="submit"
								variant="danger"
								disabled={supprimer.isPending || !suppression.trim()}
							>
								{supprimer.isPending ? "Suppression..." : "Supprimer"}
							</Button>
						</div>
					</form>
				)}
			</FormModal>
		</div>
	);
}

function Champ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
	return (
		<div>
			<label htmlFor={id} className="mb-1 block text-sm font-medium">
				{label}
			</label>
			{children}
		</div>
	);
}
