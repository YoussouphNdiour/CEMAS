"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Decision } from "@/modules/academic/passage";
import { trpc } from "@/shared/lib/trpc-client";
import { Button, ConfirmDialog, PageHeader } from "@/shared/ui";

const INPUT =
	"w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const DECISIONS: { valeur: Decision; libelle: string }[] = [
	{ valeur: "passe", libelle: "Passe" },
	{ valeur: "redouble", libelle: "Redouble" },
	{ valeur: "quitte", libelle: "Quitte" },
];

export default function PassagePage() {
	const utils = trpc.useUtils();
	const ctx = trpc.academic.passage.contexte.useQuery();
	const [etape, setEtape] = useState(1);
	const [cible, setCible] = useState({ libelle: "", dateDebut: "", dateFin: "" });
	const [suivantes, setSuivantes] = useState<Record<string, string>>({});
	const [decisions, setDecisions] = useState<Record<string, Decision>>({});
	const [confirmer, setConfirmer] = useState(false);

	useEffect(() => {
		if (!ctx.data) return;
		setCible((c) => (c.libelle ? c : ctx.data.proposition));
		setSuivantes((s) =>
			Object.keys(s).length
				? s
				: Object.fromEntries(
						ctx.data.classes.map((c) => [c.id, c.finDeCycle ? "fin" : (c.classeSuivanteId ?? "")]),
					),
		);
	}, [ctx.data]);

	const configurer = trpc.academic.passage.configurerClasses.useMutation({
		onSuccess: async () => {
			await utils.academic.passage.contexte.invalidate();
			setEtape(3);
		},
	});
	const preview = trpc.academic.passage.preview.useQuery({ decisions }, { enabled: etape === 4 });
	const executer = trpc.academic.passage.executer.useMutation({
		onSuccess: () => {
			setConfirmer(false);
			utils.invalidate();
		},
	});

	const classes = ctx.data?.classes ?? [];
	const toutesConfigurees = classes.every((c) => suivantes[c.id]);
	const elevesParClasse = useMemo(() => {
		const m = new Map<string, NonNullable<typeof ctx.data>["eleves"]>();
		for (const e of ctx.data?.eleves ?? []) m.set(e.classeId, [...(m.get(e.classeId) ?? []), e]);
		return m;
	}, [ctx.data]);
	const plan = preview.data;
	const depassements = plan?.effectifsPrevus.filter((e) => e.effectif > e.capacite) ?? [];

	if (ctx.isLoading) return <p className="text-sm text-muted">Chargement...</p>;
	if (ctx.error) return <p className="text-sm text-danger">{ctx.error.message}</p>;
	if (!ctx.data) return null;

	if (executer.data) {
		const r = executer.data;
		return (
			<div>
				<PageHeader
					title="Passage à l'année suivante"
					breadcrumbs={[
						{ label: "Académique" },
						{ label: "Années scolaires", href: "/academique/annees" },
						{ label: "Passage" },
					]}
				/>
				<div className="rounded-xl bg-green-50 p-6 text-green-800">
					<h2 className="mb-2 text-lg font-semibold">Passage effectué</h2>
					<p>
						Année {cible.libelle} active. {r.promus} promus, {r.redoublants} redoublants,{" "}
						{r.sortants} sortants, {r.departs} départs. {r.classesCreees} classes créées,{" "}
						{r.grilleCopiee} montants de grille recopiés.
					</p>
					<Link href="/eleves" className="mt-3 inline-block font-medium underline">
						Voir les élèves
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div>
			<PageHeader
				title="Passage à l'année suivante"
				breadcrumbs={[
					{ label: "Académique" },
					{ label: "Années scolaires", href: "/academique/annees" },
					{ label: "Passage" },
				]}
			/>
			<p className="mb-6 text-sm text-muted">
				Année en cours : {ctx.data.source.libelle}. Étape {etape} sur 4.
			</p>

			<div className="rounded-xl bg-surface p-6 shadow-sm">
				{etape === 1 && (
					<div className="max-w-md space-y-4">
						<h2 className="text-lg font-semibold">1. Nouvelle année</h2>
						<div>
							<label htmlFor="cible-libelle" className="mb-1 block text-sm font-medium">
								Libellé
							</label>
							<input
								id="cible-libelle"
								className={INPUT}
								value={cible.libelle}
								onChange={(e) => setCible({ ...cible, libelle: e.target.value })}
							/>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label htmlFor="cible-debut" className="mb-1 block text-sm font-medium">
									Date de début
								</label>
								<input
									id="cible-debut"
									type="date"
									className={INPUT}
									value={cible.dateDebut}
									onChange={(e) => setCible({ ...cible, dateDebut: e.target.value })}
								/>
							</div>
							<div>
								<label htmlFor="cible-fin" className="mb-1 block text-sm font-medium">
									Date de fin
								</label>
								<input
									id="cible-fin"
									type="date"
									className={INPUT}
									value={cible.dateFin}
									onChange={(e) => setCible({ ...cible, dateFin: e.target.value })}
								/>
							</div>
						</div>
						<Button
							disabled={!cible.libelle || !cible.dateDebut || !cible.dateFin}
							onClick={() => setEtape(2)}
						>
							Suivant
						</Button>
					</div>
				)}

				{etape === 2 && (
					<div className="space-y-4">
						<h2 className="text-lg font-semibold">2. Classes</h2>
						<p className="text-sm text-muted">
							Pour chaque classe, choisissez la classe suivante ou « Fin de cycle » (les élèves qui
							passent quittent l'école).
						</p>
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b text-left text-xs uppercase text-muted">
									<th className="px-3 py-2">Classe</th>
									<th className="px-3 py-2">Niveau</th>
									<th className="px-3 py-2">Classe suivante</th>
								</tr>
							</thead>
							<tbody>
								{classes.map((c) => (
									<tr key={c.id} className="border-b last:border-0">
										<td className="px-3 py-2 font-medium">{c.nom}</td>
										<td className="px-3 py-2 text-muted">{c.niveauNom}</td>
										<td className="px-3 py-2">
											<select
												aria-label={`Classe suivante de ${c.nom}`}
												className={INPUT}
												value={suivantes[c.id] ?? ""}
												onChange={(e) => setSuivantes({ ...suivantes, [c.id]: e.target.value })}
											>
												<option value="">À configurer</option>
												<option value="fin">Fin de cycle</option>
												{classes
													.filter((x) => x.id !== c.id)
													.map((x) => (
														<option key={x.id} value={x.id}>
															{x.nom}
														</option>
													))}
											</select>
										</td>
									</tr>
								))}
							</tbody>
						</table>
						{configurer.error && <p className="text-sm text-danger">{configurer.error.message}</p>}
						<div className="flex gap-2">
							<Button variant="ghost" onClick={() => setEtape(1)}>
								Précédent
							</Button>
							<Button
								disabled={!toutesConfigurees || configurer.isPending}
								onClick={() =>
									configurer.mutate({
										classes: classes.map((c) => ({
											id: c.id,
											finDeCycle: suivantes[c.id] === "fin",
											classeSuivanteId:
												suivantes[c.id] && suivantes[c.id] !== "fin" ? suivantes[c.id] : null,
										})),
									})
								}
							>
								Enregistrer et continuer
							</Button>
						</div>
					</div>
				)}

				{etape === 3 && (
					<div className="space-y-6">
						<h2 className="text-lg font-semibold">3. Élèves</h2>
						{classes.map((c) => {
							const liste = elevesParClasse.get(c.id) ?? [];
							if (liste.length === 0) return null;
							return (
								<div key={c.id}>
									<div className="mb-2 flex items-center justify-between">
										<h3 className="font-medium">
											{c.nom} <span className="text-sm text-muted">({liste.length})</span>
										</h3>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => {
												const d = { ...decisions };
												for (const e of liste) delete d[e.id];
												setDecisions(d);
											}}
										>
											Tous passent
										</Button>
									</div>
									<table className="w-full text-sm">
										<tbody>
											{liste.map((e) => (
												<tr key={e.id} className="border-b last:border-0">
													<td className="px-3 py-1.5">
														{e.prenom} {e.nom}
													</td>
													<td className="px-3 py-1.5 text-muted">{e.matricule}</td>
													<td className="px-3 py-1.5">
														<div className="flex gap-4">
															{DECISIONS.map((d) => (
																<label key={d.valeur} className="flex items-center gap-1">
																	<input
																		type="radio"
																		name={`decision-${e.id}`}
																		className="accent-primary"
																		checked={(decisions[e.id] ?? "passe") === d.valeur}
																		onChange={() => {
																			const suivant = { ...decisions };
																			if (d.valeur === "passe") delete suivant[e.id];
																			else suivant[e.id] = d.valeur;
																			setDecisions(suivant);
																		}}
																	/>
																	{d.libelle}
																</label>
															))}
														</div>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							);
						})}
						<div className="flex gap-2">
							<Button variant="ghost" onClick={() => setEtape(2)}>
								Précédent
							</Button>
							<Button onClick={() => setEtape(4)}>Suivant</Button>
						</div>
					</div>
				)}

				{etape === 4 && (
					<div className="space-y-6">
						<h2 className="text-lg font-semibold">4. Vérification</h2>
						{preview.isLoading && <p className="text-sm text-muted">Calcul...</p>}
						{plan && plan.erreurs.length > 0 && (
							<div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
								{plan.erreurs.join(" ; ")}
							</div>
						)}
						{plan && (
							<>
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b text-left text-xs uppercase text-muted">
											<th className="px-3 py-2">Classe</th>
											<th className="px-3 py-2 text-right">Promus</th>
											<th className="px-3 py-2 text-right">Redoublants</th>
											<th className="px-3 py-2 text-right">Sortants</th>
											<th className="px-3 py-2 text-right">Départs</th>
										</tr>
									</thead>
									<tbody>
										{plan.parClasse.map((l) => (
											<tr key={l.classeId} className="border-b last:border-0">
												<td className="px-3 py-2">{l.nom}</td>
												<td className="px-3 py-2 text-right">{l.promus}</td>
												<td className="px-3 py-2 text-right">{l.redoublants}</td>
												<td className="px-3 py-2 text-right">{l.sortants}</td>
												<td className="px-3 py-2 text-right">{l.departs}</td>
											</tr>
										))}
									</tbody>
								</table>
								<div>
									<h3 className="mb-2 font-medium">Effectifs prévus en {cible.libelle}</h3>
									<ul className="grid gap-1 text-sm sm:grid-cols-3">
										{plan.effectifsPrevus.map((e) => (
											<li
												key={e.classeSourceId}
												className={e.effectif > e.capacite ? "font-medium text-orange-700" : ""}
											>
												{e.nom} : {e.effectif} / {e.capacite}
											</li>
										))}
									</ul>
									{depassements.length > 0 && (
										<p className="mt-2 text-sm text-orange-700">
											{depassements.length} classe(s) dépasseront leur capacité.
										</p>
									)}
								</div>
								<p className="rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-800">
									Opération définitive : l'année {ctx.data.source.libelle} sera archivée. Vérifiez
									qu'une sauvegarde récente existe (voir docs/19_sauvegardes.md).
								</p>
							</>
						)}
						{executer.error && <p className="text-sm text-danger">{executer.error.message}</p>}
						<div className="flex gap-2">
							<Button variant="ghost" onClick={() => setEtape(3)}>
								Précédent
							</Button>
							<Button
								disabled={!plan || plan.erreurs.length > 0}
								onClick={() => setConfirmer(true)}
							>
								Lancer le passage
							</Button>
						</div>
					</div>
				)}
			</div>

			<ConfirmDialog
				open={confirmer}
				onClose={() => setConfirmer(false)}
				onConfirm={() => executer.mutate({ cible, decisions })}
				title={`Passer à l'année ${cible.libelle} ?`}
				message={`L'année ${ctx.data.source.libelle} sera archivée et les élèves répartis selon vos choix. Cette opération ne peut pas être annulée.`}
				confirmLabel="Confirmer le passage"
				loadingLabel="Passage en cours..."
				confirmVariant="primary"
				loading={executer.isPending}
			/>
		</div>
	);
}
