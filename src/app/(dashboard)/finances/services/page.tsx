"use client";

import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { formatCFA, MOIS_LABELS } from "@/shared/lib/utils";
import { Button, PageHeader } from "@/shared/ui";

const CHAMP =
	"w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm text-right focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

function Montant({
	service,
	estAdmin,
}: {
	service: { id: string; nom: string; montantDefaut: number };
	estAdmin: boolean;
}) {
	const utils = trpc.useUtils();
	const [valeur, setValeur] = useState(String(service.montantDefaut));
	const modifier = trpc.finance.services.modifierMontant.useMutation({
		onSuccess: () => {
			utils.finance.services.list.invalidate();
			utils.finance.tarifs.pourEleve.invalidate();
			utils.finance.impayes.list.invalidate();
			utils.dashboard.stats.invalidate();
		},
	});
	if (!estAdmin)
		return <span className="text-sm text-muted">{formatCFA(service.montantDefaut)}/mois</span>;
	return (
		<form
			className="flex items-center gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				modifier.mutate({ typeFraisId: service.id, montant: Number(valeur) || 0 });
			}}
		>
			<label htmlFor={`montant-${service.id}`} className="text-sm text-muted">
				Montant mensuel
			</label>
			<input
				id={`montant-${service.id}`}
				type="number"
				min={0}
				className={CHAMP}
				value={valeur}
				onChange={(e) => setValeur(e.target.value)}
			/>
			<Button size="sm" type="submit" disabled={modifier.isPending || !(Number(valeur) > 0)}>
				Enregistrer
			</Button>
			{modifier.isSuccess && <span className="text-xs text-green-700">Enregistré</span>}
			{modifier.error && <span className="text-xs text-danger">{modifier.error.message}</span>}
		</form>
	);
}

export default function ServicesPage() {
	const annees = trpc.academic.annees.list.useQuery();
	const annee = annees.data?.find((a) => a.active);
	const moi = trpc.settings.moi.useQuery();
	const services = trpc.finance.services.list.useQuery();
	const abonnes = trpc.finance.abonnements.listParService.useQuery(
		{ anneeScolaireId: annee?.id ?? "" },
		{ enabled: !!annee },
	);

	return (
		<div>
			<PageHeader
				title="Services"
				breadcrumbs={[{ label: "Finances", href: "/finances/paiements" }, { label: "Services" }]}
			/>
			<p className="mb-4 text-sm text-muted">
				Garderie, cours de renforcement et cantine : dus chaque mois pour les élèves abonnés, du
				mois d'abonnement à juin. On abonne un élève depuis sa fiche (section « Services »).
			</p>
			<div className="space-y-6">
				{services.data?.map((s) => {
					const liste = (abonnes.data ?? []).filter((a) => a.typeFraisId === s.id);
					return (
						<section key={s.id} aria-label={s.nom} className="rounded-xl bg-surface p-5 shadow-sm">
							<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
								<h2 className="text-lg font-semibold">
									{s.nom}{" "}
									<span className="text-sm font-normal text-muted">
										({liste.length} abonné{liste.length > 1 ? "s" : ""})
									</span>
								</h2>
								<Montant service={s} estAdmin={moi.data?.estAdmin ?? false} />
							</div>
							{liste.length === 0 ? (
								<p className="text-sm text-muted">Aucun abonné cette année.</p>
							) : (
								<table className="w-full text-left text-sm">
									<thead>
										<tr className="border-b text-xs uppercase text-muted">
											<th className="py-2 pr-2">Élève</th>
											<th className="py-2 pr-2">Classe</th>
											<th className="py-2 pr-2">Abonnement</th>
											<th className="py-2 pr-2 text-right">Mois payés / dus</th>
										</tr>
									</thead>
									<tbody>
										{liste.map((a) => (
											<tr key={a.eleveId} className="border-b last:border-0">
												<td className="py-2 pr-2">
													<Link href={`/eleves/${a.eleveId}`} className="hover:underline">
														{a.prenom} {a.nom}
													</Link>
													{a.statut !== "actif" && (
														<span className="ml-2 text-xs text-muted">(retiré)</span>
													)}
												</td>
												<td className="py-2 pr-2">{a.classeNom}</td>
												<td className="py-2 pr-2">
													{MOIS_LABELS[a.moisDebut]} → {a.moisFin ? MOIS_LABELS[a.moisFin] : "Juin"}
												</td>
												<td
													className={`py-2 pr-2 text-right ${a.moisPayes < a.moisDus ? "text-danger" : ""}`}
												>
													{a.moisPayes} / {a.moisDus}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</section>
					);
				})}
			</div>
		</div>
	);
}
