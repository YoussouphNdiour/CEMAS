"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { formatCFA } from "@/shared/lib/utils";
import { Button, PageHeader } from "@/shared/ui";

const cle = (classeId: string, fraisId: string) => `${classeId}:${fraisId}`;
const INPUT =
	"w-32 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function GrillePage() {
	const utils = trpc.useUtils();
	const annees = trpc.academic.annees.list.useQuery();
	const annee = annees.data?.find((a) => a.active);
	const classes = trpc.academic.classes.list.useQuery(
		{ anneeScolaireId: annee?.id ?? "" },
		{ enabled: !!annee },
	);
	const typesFrais = trpc.finance.typesFrais.list.useQuery();
	const grille = trpc.finance.grilleFrais.list.useQuery(
		{ anneeScolaireId: annee?.id ?? "" },
		{ enabled: !!annee },
	);

	const frais = useMemo(
		() => (typesFrais.data ?? []).filter((f) => f.obligatoire),
		[typesFrais.data],
	);
	const lignes = useMemo(
		() =>
			[...(classes.data ?? [])].sort(
				(a, b) => (a.niveau?.ordre ?? 0) - (b.niveau?.ordre ?? 0) || a.nom.localeCompare(b.nom),
			),
		[classes.data],
	);

	const enregistre = useMemo(
		() =>
			new Map((grille.data ?? []).map((g) => [cle(g.classeId, g.typeFraisId), g.montantMensuel])),
		[grille.data],
	);
	/** Saisies de l'utilisateur, superposées aux montants enregistrés (un rechargement ne les efface pas). */
	const [modifs, setModifs] = useState<Record<string, string>>({});
	const [message, setMessage] = useState("");
	const valeur = (k: string) => modifs[k] ?? (enregistre.has(k) ? String(enregistre.get(k)) : "");

	const save = trpc.finance.grilleFrais.upsertMany.useMutation({
		onSuccess: (_data, variables) => {
			setMessage("Grille enregistrée");
			setModifs((m) => {
				const reste = { ...m };
				for (const c of variables.cellules) delete reste[cle(c.classeId, c.typeFraisId)];
				return reste;
			});
			utils.finance.grilleFrais.list.invalidate();
			utils.finance.impayes.list.invalidate();
		},
	});

	function appliquerAuNiveau(classeId: string, niveauId: string) {
		const suivantes = { ...modifs };
		for (const c of lignes.filter((l) => l.niveauId === niveauId && l.id !== classeId)) {
			for (const f of frais) {
				const v = valeur(cle(classeId, f.id));
				if (v) suivantes[cle(c.id, f.id)] = v;
			}
		}
		setModifs(suivantes);
	}

	function enregistrer() {
		if (!annee) return;
		setMessage("");
		const cellules = Object.entries(modifs)
			.filter(([k, v]) => v !== "" && Number(v) !== enregistre.get(k))
			.map(([k, v]) => {
				const [classeId, typeFraisId] = k.split(":");
				return { classeId, typeFraisId, montant: Number(v) };
			});
		if (cellules.some((c) => !Number.isInteger(c.montant) || c.montant < 0)) {
			setMessage("Les montants doivent être des nombres entiers positifs.");
			return;
		}
		if (cellules.length === 0) {
			setMessage("Aucune modification.");
			return;
		}
		save.mutate({ anneeScolaireId: annee.id, cellules });
	}

	return (
		<div>
			<PageHeader
				title="Grille tarifaire"
				breadcrumbs={[
					{ label: "Finances", href: "/finances/paiements" },
					{ label: "Grille tarifaire" },
				]}
			/>
			<p className="mb-4 text-sm text-muted">
				Montant par classe pour chaque frais obligatoire de l'année {annee?.libelle ?? ""}. Une case
				vide utilise le montant par défaut (affiché en gris) et est signalée sur la page Impayés.
			</p>
			<div className="overflow-x-auto rounded-xl bg-surface p-4 shadow-sm">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b text-left text-xs uppercase text-muted">
							<th className="px-3 py-2">Classe</th>
							<th className="px-3 py-2">Niveau</th>
							{frais.map((f) => (
								<th key={f.id} className="px-3 py-2">
									{f.nom}{" "}
									<span className="normal-case">({f.mensuel ? "par mois" : "une fois"})</span>
								</th>
							))}
							<th className="px-3 py-2" />
						</tr>
					</thead>
					<tbody>
						{lignes.map((c) => (
							<tr key={c.id} className="border-b last:border-0">
								<td className="px-3 py-2 font-medium">{c.nom}</td>
								<td className="px-3 py-2 text-muted">{c.niveau?.nom}</td>
								{frais.map((f) => {
									const k = cle(c.id, f.id);
									return (
										<td key={f.id} className="px-3 py-2">
											<input
												type="number"
												min={0}
												step={500}
												aria-label={`${c.nom} — ${f.nom}`}
												value={valeur(k)}
												placeholder={String(f.montantDefaut)}
												onChange={(e) => setModifs({ ...modifs, [k]: e.target.value })}
												className={INPUT}
											/>
											{!enregistre.has(k) && (
												<span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">
													à renseigner
												</span>
											)}
										</td>
									);
								})}
								<td className="px-3 py-2 text-right">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => appliquerAuNiveau(c.id, c.niveauId)}
									>
										Appliquer au niveau
									</Button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="mt-4 flex items-center gap-4">
				<Button onClick={enregistrer} disabled={save.isPending}>
					{save.isPending ? "Enregistrement..." : "Enregistrer"}
				</Button>
				{message && <span className="text-sm text-muted">{message}</span>}
				{save.error && <span className="text-sm text-danger">{save.error.message}</span>}
			</div>
			<p className="mt-2 text-xs text-muted">
				Montants par défaut :{" "}
				{frais.map((f) => `${f.nom} ${formatCFA(f.montantDefaut)}`).join(" · ")}
			</p>
		</div>
	);
}
