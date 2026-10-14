"use client";

import { Pencil, Trash2, UserMinus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { Button, ConfirmDialog, FormModal } from "@/shared/ui";

const CHAMP =
	"w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export interface EleveFiche {
	id: string;
	matricule: string;
	prenom: string;
	nom: string;
	dateNaissance: string;
	lieuNaissance: string | null;
	sexe: string;
	adresse: string | null;
	statut: string;
	classeId: string;
	anneeScolaireId: string;
}

/** Actions de l'administrateur sur la fiche élève : modifier, retirer / réintégrer, supprimer. */
export function GestionEleve({ eleve }: { eleve: EleveFiche }) {
	const router = useRouter();
	const utils = trpc.useUtils();
	const classes = trpc.academic.classes.list.useQuery({ anneeScolaireId: eleve.anneeScolaireId });
	const [edition, setEdition] = useState<EleveFiche | null>(null);
	const [retrait, setRetrait] = useState<"inactif" | "transfere" | null>(null);
	const [motifRetrait, setMotifRetrait] = useState("");
	const [suppression, setSuppression] = useState(false);
	const [info, setInfo] = useState<string | null>(null);

	const rafraichir = () => {
		utils.students.getById.invalidate({ id: eleve.id });
		utils.students.list.invalidate();
		utils.finance.impayes.list.invalidate();
		utils.finance.tarifs.pourEleve.invalidate();
		utils.dashboard.stats.invalidate();
	};
	const modifier = trpc.students.update.useMutation({
		onSuccess: (r) => {
			setEdition(null);
			setRetrait(null);
			setInfo(
				r.niveauChange && r.niveauNom
					? `Les tarifs du niveau ${r.niveauNom} s'appliquent désormais (forfait, mensualités).`
					: null,
			);
			rafraichir();
		},
	});
	const supprimer = trpc.students.delete.useMutation({
		onSuccess: () => {
			utils.students.list.invalidate();
			router.push("/eleves");
		},
	});
	const actif = eleve.statut === "actif";

	return (
		<>
			<div className="flex flex-wrap gap-2">
				<Button variant="outline" size="sm" onClick={() => setEdition({ ...eleve })}>
					<Pencil className="h-4 w-4" />
					Modifier l'élève
				</Button>
				{actif ? (
					<Button variant="outline" size="sm" onClick={() => setRetrait("inactif")}>
						<UserMinus className="h-4 w-4" />
						Retirer de l'école
					</Button>
				) : (
					<Button
						variant="outline"
						size="sm"
						disabled={modifier.isPending}
						onClick={() => modifier.mutate({ id: eleve.id, statut: "actif" })}
					>
						<UserPlus className="h-4 w-4" />
						Réintégrer
					</Button>
				)}
				<Button variant="ghost" size="sm" onClick={() => setSuppression(true)}>
					<Trash2 className="h-4 w-4 text-red-500" />
					Supprimer
				</Button>
			</div>
			{info && (
				<p className="mt-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{info}</p>
			)}
			{modifier.error && !edition && !retrait && (
				<p className="mt-2 text-sm text-danger">{modifier.error.message}</p>
			)}

			<FormModal open={edition !== null} onClose={() => setEdition(null)} title="Modifier l'élève">
				{edition && (
					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							modifier.mutate({
								id: eleve.id,
								prenom: edition.prenom,
								nom: edition.nom,
								dateNaissance: edition.dateNaissance,
								lieuNaissance: edition.lieuNaissance ?? "",
								sexe: edition.sexe as "M" | "F",
								adresse: edition.adresse ?? "",
								classeId: edition.classeId,
							});
						}}
					>
						<div className="grid grid-cols-2 gap-4">
							<Champ id="edit-prenom" label="Prénom *">
								<input
									id="edit-prenom"
									className={CHAMP}
									required
									value={edition.prenom}
									onChange={(e) => setEdition({ ...edition, prenom: e.target.value })}
								/>
							</Champ>
							<Champ id="edit-nom" label="Nom *">
								<input
									id="edit-nom"
									className={CHAMP}
									required
									value={edition.nom}
									onChange={(e) => setEdition({ ...edition, nom: e.target.value })}
								/>
							</Champ>
							<Champ id="edit-naissance" label="Date de naissance *">
								<input
									id="edit-naissance"
									type="date"
									className={CHAMP}
									required
									value={edition.dateNaissance}
									onChange={(e) => setEdition({ ...edition, dateNaissance: e.target.value })}
								/>
							</Champ>
							<Champ id="edit-lieu" label="Lieu de naissance">
								<input
									id="edit-lieu"
									className={CHAMP}
									value={edition.lieuNaissance ?? ""}
									onChange={(e) => setEdition({ ...edition, lieuNaissance: e.target.value })}
								/>
							</Champ>
							<Champ id="edit-sexe" label="Sexe">
								<select
									id="edit-sexe"
									className={CHAMP}
									value={edition.sexe}
									onChange={(e) => setEdition({ ...edition, sexe: e.target.value })}
								>
									<option value="M">Masculin</option>
									<option value="F">Féminin</option>
								</select>
							</Champ>
							<Champ id="edit-classe" label="Classe">
								<select
									id="edit-classe"
									className={CHAMP}
									value={edition.classeId}
									onChange={(e) => setEdition({ ...edition, classeId: e.target.value })}
								>
									{classes.data?.map((c) => (
										<option key={c.id} value={c.id}>
											{c.nom}
										</option>
									))}
								</select>
							</Champ>
						</div>
						<Champ id="edit-adresse" label="Adresse">
							<input
								id="edit-adresse"
								className={CHAMP}
								value={edition.adresse ?? ""}
								onChange={(e) => setEdition({ ...edition, adresse: e.target.value })}
							/>
						</Champ>
						{modifier.error && <p className="text-sm text-danger">{modifier.error.message}</p>}
						<div className="flex justify-end gap-2">
							<Button type="button" variant="ghost" onClick={() => setEdition(null)}>
								Annuler
							</Button>
							<Button type="submit" disabled={modifier.isPending}>
								{modifier.isPending ? "Enregistrement..." : "Enregistrer"}
							</Button>
						</div>
					</form>
				)}
			</FormModal>

			<FormModal
				open={retrait !== null}
				onClose={() => setRetrait(null)}
				title="Retirer de l'école"
			>
				{retrait && (
					<div className="space-y-4">
						<p className="text-sm text-muted">
							L'élève n'apparaîtra plus dans les effectifs ni les impayés ; ses paiements restent
							dans la comptabilité.
						</p>
						<div className="flex gap-6 text-sm">
							{(["inactif", "transfere"] as const).map((s) => (
								<label key={s} className="flex items-center gap-2">
									<input
										type="radio"
										name="retrait"
										checked={retrait === s}
										onChange={() => setRetrait(s)}
									/>
									{s === "inactif" ? "Inactif (départ)" : "Transféré"}
								</label>
							))}
						</div>
						<Champ id="retrait-motif" label="Motif">
							<input
								id="retrait-motif"
								className={CHAMP}
								maxLength={300}
								placeholder="Facultatif"
								value={motifRetrait}
								onChange={(e) => setMotifRetrait(e.target.value)}
							/>
						</Champ>
						{modifier.error && <p className="text-sm text-danger">{modifier.error.message}</p>}
						<div className="flex justify-end gap-2">
							<Button variant="ghost" onClick={() => setRetrait(null)}>
								Annuler
							</Button>
							<Button
								disabled={modifier.isPending}
								onClick={() =>
									modifier.mutate({
										id: eleve.id,
										statut: retrait,
										motif: motifRetrait || undefined,
									})
								}
							>
								Retirer
							</Button>
						</div>
					</div>
				)}
			</FormModal>

			<ConfirmDialog
				open={suppression}
				onClose={() => {
					setSuppression(false);
					supprimer.reset();
				}}
				onConfirm={() => supprimer.mutate({ id: eleve.id })}
				title="Supprimer la fiche ?"
				message={
					supprimer.error?.message ??
					`La fiche ${eleve.matricule} — ${eleve.prenom} ${eleve.nom} sera supprimée définitivement (possible seulement sans paiement).`
				}
				confirmLabel="Supprimer"
				loadingLabel="Suppression..."
				loading={supprimer.isPending}
			/>
		</>
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
