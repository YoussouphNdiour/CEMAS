"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { libelleDateFr } from "@/modules/academic/fenetre";
import type { Decision } from "@/modules/academic/passage";
import { trpc } from "@/shared/lib/trpc-client";
import { formatCFA } from "@/shared/lib/utils";
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
	const [retires, setRetires] = useState(0);
	const initialise = useRef(false);

	useEffect(() => {
		if (!ctx.data) return;
		// Initialisation unique : un rechargement des données n'écrase pas les saisies
		if (!initialise.current) {
			initialise.current = true;
			setDecisions(ctx.data.decisions);
			setCible(ctx.data.proposition);
			setSuivantes(
				Object.fromEntries(
					ctx.data.classes.map((c) => [c.id, c.finDeCycle ? "fin" : (c.classeSuivanteId ?? "")]),
				),
			);
		}
		// Décisions d'élèves qui ne sont plus concernés (désactivés entre-temps) : retirées
		const concernes = new Set(ctx.data.eleves.map((e) => e.id));
		setDecisions((d) => {
			const obsoletes = Object.keys(d).filter((id) => !concernes.has(id));
			if (obsoletes.length === 0) return d;
			setRetires(obsoletes.length);
			const suivant = { ...d };
			for (const id of obsoletes) delete suivant[id];
			return suivant;
		});
	}, [ctx.data]);

	const configurer = trpc.academic.passage.configurerClasses.useMutation({
		onSuccess: async () => {
			await utils.academic.passage.contexte.invalidate();
			setEtape(3);
		},
	});
	const preview = trpc.academic.passage.preview.useQuery({ decisions }, { enabled: etape >= 4 });
	const executer = trpc.academic.passage.executer.useMutation({
		onSuccess: () => {
			setConfirmer(false);
			utils.invalidate();
		},
	});
	const enregistrer = trpc.academic.passage.enregistrerDecisions.useMutation({
		onSuccess: () => utils.academic.passage.contexte.invalidate(),
	});
	const controles = trpc.academic.passage.controles.useQuery(undefined, { enabled: etape === 5 });
	const sauver = trpc.academic.passage.sauvegarder.useMutation({
		onSuccess: () => controles.refetch(),
	});
	const [coches, setCoches] = useState({ classes: false, decisions: false, grille: false });
	const ageLisible = (iso: string) => {
		const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
		return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
	};

	const classes = ctx.data?.classes ?? [];
	const toutesConfigurees = classes.every((c) => suivantes[c.id]);
	const elevesParClasse = useMemo(() => {
		const m = new Map<string, NonNullable<typeof ctx.data>["eleves"]>();
		for (const e of ctx.data?.eleves ?? []) m.set(e.classeId, [...(m.get(e.classeId) ?? []), e]);
		return m;
	}, [ctx.data]);
	const plan = preview.data;
	const pret =
		!!controles.data &&
		controles.data.fenetre.etat === "ouvert" &&
		controles.data.sauvegardeRecente &&
		coches.classes &&
		coches.decisions &&
		coches.grille &&
		!!plan &&
		plan.erreurs.length === 0;
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
						{r.grilleCopiee} montants de grille recopiés. Sauvegarde avant passage :{" "}
						{r.sauvegardeAvantPassage}.
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
			{ctx.data.fenetre.etat !== "ouvert" && (
				<p className="mb-4 rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-800">
					Préparation : le passage pourra être lancé à partir du{" "}
					{libelleDateFr(ctx.data.fenetre.ouverture)}. Vous pouvez dès maintenant configurer les
					classes et enregistrer les décisions.
				</p>
			)}
			{retires > 0 && (
				<p className="mb-4 rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-800">
					{retires} décision(s) retirée(s) : ces élèves ne sont plus actifs dans l'année en cours.
				</p>
			)}
			<p className="mb-6 text-sm text-muted">
				Année en cours : {ctx.data.source.libelle}. Étape {etape} sur 5.
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
							<Button
								variant="outline"
								disabled={enregistrer.isPending}
								onClick={() =>
									enregistrer.mutate({
										decisions: Object.fromEntries(
											Object.entries(decisions).filter(([, d]) => d !== "passe"),
										) as Record<string, "redouble" | "quitte">,
									})
								}
							>
								{enregistrer.isPending ? "Enregistrement..." : "Enregistrer les décisions"}
							</Button>
							<Button onClick={() => setEtape(4)}>Suivant</Button>
							{enregistrer.isSuccess && (
								<span className="self-center text-sm text-green-700">Décisions enregistrées</span>
							)}
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
							</>
						)}
						{executer.error && <p className="text-sm text-danger">{executer.error.message}</p>}
						<div className="flex gap-2">
							<Button variant="ghost" onClick={() => setEtape(3)}>
								Précédent
							</Button>
							<Button disabled={!plan || plan.erreurs.length > 0} onClick={() => setEtape(5)}>
								Suivant
							</Button>
						</div>
					</div>
				)}
				{etape === 5 && (
					<div className="space-y-6">
						<h2 className="text-lg font-semibold">5. Contrôles et lancement</h2>
						{controles.isLoading && <p className="text-sm text-muted">Vérification...</p>}
						{controles.error && (
							<p className="text-sm text-danger">
								Contrôles impossibles : {controles.error.message}
							</p>
						)}
						{controles.data && (
							<ul className="space-y-3 text-sm">
								<li
									className={
										controles.data.fenetre.etat === "ouvert" ? "text-green-700" : "text-red-700"
									}
								>
									{controles.data.fenetre.etat === "ouvert"
										? "Année terminée : le passage est possible."
										: `Passage disponible à partir du ${libelleDateFr(controles.data.fenetre.ouverture)}.`}
								</li>
								<li
									className={controles.data.sauvegardeRecente ? "text-green-700" : "text-red-700"}
								>
									{controles.data.sauvegarde
										? `Dernière sauvegarde : il y a ${ageLisible(controles.data.sauvegarde.date)} (${controles.data.sauvegarde.nom}, ${Math.round(controles.data.sauvegarde.taille / 1024)} Ko)`
										: controles.data.sauvegardesConfigurees
											? "Aucune sauvegarde trouvée."
											: "Sauvegardes non configurées sur ce serveur."}
									{!controles.data.sauvegardeRecente &&
										" — une sauvegarde de moins de 24 h est requise."}{" "}
									<Button
										variant="ghost"
										size="sm"
										disabled={sauver.isPending}
										onClick={() => sauver.mutate()}
									>
										{sauver.isPending ? "Sauvegarde..." : "Faire une sauvegarde maintenant"}
									</Button>
									{sauver.error && <span className="ml-2 text-danger">{sauver.error.message}</span>}
								</li>
								<li className="text-gray-700">
									Impayés restants sur {ctx.data.source.libelle} :{" "}
									{formatCFA(controles.data.totalImpayes)}
								</li>
							</ul>
						)}
						<fieldset className="space-y-2 text-sm">
							<legend className="mb-1 font-medium">Avant de lancer</legend>
							{(
								[
									["classes", "Classes suivantes vérifiées"],
									["decisions", "Redoublants et départs décidés"],
									["grille", "Grille tarifaire de la nouvelle année revue"],
								] as const
							).map(([cle, libelle]) => (
								<label key={cle} className="flex items-center gap-2">
									<input
										type="checkbox"
										className="accent-primary"
										checked={coches[cle]}
										onChange={(e) => setCoches({ ...coches, [cle]: e.target.checked })}
									/>
									{libelle}
								</label>
							))}
						</fieldset>
						<p className="rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-800">
							Opération définitive : l'année {ctx.data.source.libelle} sera archivée. Une sauvegarde
							est faite automatiquement juste avant le passage.
						</p>
						{executer.error && <p className="text-sm text-danger">{executer.error.message}</p>}
						<div className="flex gap-2">
							<Button variant="ghost" onClick={() => setEtape(4)}>
								Précédent
							</Button>
							<Button disabled={!pret} onClick={() => setConfirmer(true)}>
								Lancer le passage
							</Button>
						</div>
					</div>
				)}
			</div>

			<ConfirmDialog
				open={confirmer}
				onClose={() => setConfirmer(false)}
				onConfirm={() =>
					executer.mutate({
						cible,
						decisions,
						confirmations: { classes: true, decisions: true, grille: true },
					})
				}
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
