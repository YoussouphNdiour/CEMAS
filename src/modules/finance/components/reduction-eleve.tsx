"use client";

import { useState } from "react";
import { LIBELLES_TYPE_REDUCTION, type Reduction } from "@/modules/finance/reductions";
import { trpc } from "@/shared/lib/trpc-client";
import { formatCFA } from "@/shared/lib/utils";
import { Button, FormModal } from "@/shared/ui";

const INPUT =
	"w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const PORTEES: Record<Reduction["portee"], string> = {
	forfait: "Forfait d'inscription",
	mensualites: "Mensualités",
	les_deux: "Forfait et mensualités",
};

type Formulaire = {
	type: Reduction["type"];
	portee: Reduction["portee"];
	mode: Reduction["mode"];
	valeur: string;
	motif: string;
};

/** Section « Réduction » de la fiche élève (année active). */
export function ReductionEleve({ eleveId }: { eleveId: string }) {
	const utils = trpc.useUtils();
	const reduction = trpc.finance.reductions.get.useQuery({ eleveId });
	const [form, setForm] = useState<Formulaire | null>(null);
	const invalider = () => {
		utils.finance.reductions.get.invalidate({ eleveId });
		utils.finance.reductions.list.invalidate();
		utils.finance.impayes.list.invalidate();
		utils.finance.tarifs.pourEleve.invalidate({ eleveId });
		utils.dashboard.stats.invalidate();
	};
	const enregistrer = trpc.finance.reductions.enregistrer.useMutation({
		onSuccess: () => {
			setForm(null);
			invalider();
		},
	});
	const supprimer = trpc.finance.reductions.supprimer.useMutation({ onSuccess: invalider });
	const r = reduction.data;

	function ouvrir() {
		setForm(
			r
				? {
						type: r.type as Reduction["type"],
						portee: r.portee as Reduction["portee"],
						mode: r.mode as Reduction["mode"],
						valeur: String(r.valeur),
						motif: r.motif ?? "",
					}
				: { type: "negociee", portee: "forfait", mode: "montant", valeur: "", motif: "" },
		);
	}

	return (
		<section aria-label="Réduction" className="rounded-xl bg-surface p-6 shadow-sm">
			<div className="mb-3 flex items-center justify-between">
				<h2 className="text-lg font-semibold">Réduction</h2>
				<Button variant="outline" size="sm" onClick={ouvrir}>
					{r ? "Modifier la réduction" : "Ajouter une réduction"}
				</Button>
			</div>
			{r ? (
				<div className="space-y-1 text-sm">
					<p className="font-medium">{LIBELLES_TYPE_REDUCTION[r.type as Reduction["type"]]}</p>
					<p className="text-muted">
						{r.mode === "pourcentage" ? `${r.valeur} %` : formatCFA(r.valeur)} —{" "}
						{PORTEES[r.portee as Reduction["portee"]]}
						{r.mode === "montant" && r.portee !== "forfait"
							? " (par mois pour les mensualités)"
							: ""}
					</p>
					{r.motif && <p className="text-muted">Motif : {r.motif}</p>}
					<Button
						variant="ghost"
						size="sm"
						disabled={supprimer.isPending}
						onClick={() => supprimer.mutate({ eleveId })}
					>
						Supprimer la réduction
					</Button>
				</div>
			) : (
				<p className="text-sm text-muted">Aucune réduction pour l'année en cours.</p>
			)}

			<FormModal open={form !== null} onClose={() => setForm(null)} title="Réduction">
				{form && (
					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							enregistrer.mutate({
								eleveId,
								type: form.type,
								portee: form.portee,
								mode: form.mode,
								valeur: Number(form.valeur) || 0,
								motif: form.motif || undefined,
							});
						}}
					>
						<div>
							<label htmlFor="red-type" className="mb-1 block text-sm font-medium">
								Type
							</label>
							<select
								id="red-type"
								className={INPUT}
								value={form.type}
								onChange={(e) => setForm({ ...form, type: e.target.value as Reduction["type"] })}
							>
								{Object.entries(LIBELLES_TYPE_REDUCTION).map(([v, l]) => (
									<option key={v} value={v}>
										{l}
									</option>
								))}
							</select>
						</div>
						<div>
							<label htmlFor="red-portee" className="mb-1 block text-sm font-medium">
								Porte sur
							</label>
							<select
								id="red-portee"
								className={INPUT}
								value={form.portee}
								onChange={(e) =>
									setForm({ ...form, portee: e.target.value as Reduction["portee"] })
								}
							>
								{Object.entries(PORTEES).map(([v, l]) => (
									<option key={v} value={v}>
										{l}
									</option>
								))}
							</select>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label htmlFor="red-mode" className="mb-1 block text-sm font-medium">
									Forme
								</label>
								<select
									id="red-mode"
									className={INPUT}
									value={form.mode}
									onChange={(e) => setForm({ ...form, mode: e.target.value as Reduction["mode"] })}
								>
									<option value="montant">Montant (FCFA)</option>
									<option value="pourcentage">Pourcentage (%)</option>
								</select>
							</div>
							<div>
								<label htmlFor="red-valeur" className="mb-1 block text-sm font-medium">
									Valeur
								</label>
								<input
									id="red-valeur"
									type="number"
									min={1}
									max={form.mode === "pourcentage" ? 100 : undefined}
									className={INPUT}
									value={form.valeur}
									onChange={(e) => setForm({ ...form, valeur: e.target.value })}
								/>
							</div>
						</div>
						<div>
							<label htmlFor="red-motif" className="mb-1 block text-sm font-medium">
								Motif
							</label>
							<input
								id="red-motif"
								className={INPUT}
								value={form.motif}
								maxLength={200}
								onChange={(e) => setForm({ ...form, motif: e.target.value })}
							/>
						</div>
						{enregistrer.error && (
							<p className="text-sm text-danger">{enregistrer.error.message}</p>
						)}
						<div className="flex justify-end gap-2">
							<Button type="button" variant="ghost" onClick={() => setForm(null)}>
								Annuler
							</Button>
							<Button type="submit" disabled={enregistrer.isPending || !form.valeur}>
								{enregistrer.isPending ? "Enregistrement..." : "Enregistrer"}
							</Button>
						</div>
					</form>
				)}
			</FormModal>
		</section>
	);
}
