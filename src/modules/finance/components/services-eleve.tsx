"use client";

import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { formatCFA, MOIS_LABELS } from "@/shared/lib/utils";
import { Button, FormModal } from "@/shared/ui";
import { DERNIER_MOIS_SERVICE, ordreScolaire } from "../abonnements";

const CHAMP =
	"w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
/** Mois où un service peut être dû : octobre → juin. */
const MOIS_SERVICE = [10, 11, 12, 1, 2, 3, 4, 5, 6];

type Dialogue =
	| { type: "abonner"; typeFraisId: string; nom: string; mois: number }
	| { type: "arreter"; typeFraisId: string; nom: string; mois: number; debut: number };

function etat(s: { abonne: boolean; moisDebut: number | null; moisFin: number | null }) {
	if (!s.abonne || s.moisDebut === null) return "Non abonné";
	return s.moisFin
		? `Abonné de ${MOIS_LABELS[s.moisDebut]} à ${MOIS_LABELS[s.moisFin]}`
		: `Abonné depuis ${MOIS_LABELS[s.moisDebut]}`;
}

/** Abonnements de l'élève aux services mensuels (garderie, renforcement, cantine). */
export function ServicesEleve({ eleveId, estAdmin }: { eleveId: string; estAdmin: boolean }) {
	const utils = trpc.useUtils();
	const tarif = trpc.finance.tarifs.pourEleve.useQuery({ eleveId });
	const [dialogue, setDialogue] = useState<Dialogue | null>(null);
	const [erreur, setErreur] = useState<string | null>(null);
	const options = {
		onSuccess: () => {
			setDialogue(null);
			setErreur(null);
			utils.finance.tarifs.pourEleve.invalidate({ eleveId });
			utils.finance.impayes.list.invalidate();
			utils.finance.abonnements.listParService.invalidate();
			utils.dashboard.stats.invalidate();
		},
		onError: (e: { message: string }) => setErreur(e.message),
	};
	const abonner = trpc.finance.abonnements.abonner.useMutation(options);
	const arreter = trpc.finance.abonnements.arreter.useMutation(options);
	const reprendre = trpc.finance.abonnements.reprendre.useMutation(options);
	const supprimer = trpc.finance.abonnements.supprimer.useMutation(options);
	const enCours =
		abonner.isPending || arreter.isPending || reprendre.isPending || supprimer.isPending;
	const courant = new Date().getMonth() + 1;
	const moisParDefaut = MOIS_SERVICE.includes(courant) ? courant : 10;
	const services = tarif.data?.services ?? [];

	return (
		<section aria-label="Services" className="rounded-xl bg-surface p-6 shadow-sm">
			<h2 className="mb-1 text-lg font-semibold">Services</h2>
			<p className="mb-4 text-sm text-muted">
				Garderie, cours de renforcement et cantine : dus chaque mois de l'abonnement, jusqu'en juin.
			</p>
			{erreur && !dialogue && <p className="mb-2 text-sm text-danger">{erreur}</p>}
			<table className="w-full text-left text-sm">
				<tbody>
					{services.map((s) => (
						<tr key={s.typeFraisId} className="border-b last:border-0">
							<td className="py-2 pr-2 font-medium">{s.nom}</td>
							<td className="py-2 pr-2 text-muted">{formatCFA(s.montant)}/mois</td>
							<td className="py-2 pr-2">{etat(s)}</td>
							{estAdmin && (
								<td className="py-2 text-right">
									{!s.abonne ? (
										<Button
											size="sm"
											variant="outline"
											onClick={() =>
												setDialogue({
													type: "abonner",
													typeFraisId: s.typeFraisId,
													nom: s.nom,
													mois: moisParDefaut,
												})
											}
										>
											S'abonner
										</Button>
									) : (
										<div className="flex justify-end gap-2">
											{s.moisFin === null ? (
												<Button
													size="sm"
													variant="outline"
													onClick={() =>
														setDialogue({
															type: "arreter",
															typeFraisId: s.typeFraisId,
															nom: s.nom,
															debut: s.moisDebut ?? 10,
															mois:
																ordreScolaire(moisParDefaut) >= ordreScolaire(s.moisDebut ?? 10)
																	? moisParDefaut
																	: (s.moisDebut ?? 10),
														})
													}
												>
													Arrêter
												</Button>
											) : (
												<Button
													size="sm"
													variant="outline"
													disabled={enCours}
													onClick={() => reprendre.mutate({ eleveId, typeFraisId: s.typeFraisId })}
												>
													Reprendre
												</Button>
											)}
											<Button
												size="sm"
												variant="ghost"
												disabled={enCours}
												onClick={() => supprimer.mutate({ eleveId, typeFraisId: s.typeFraisId })}
											>
												Supprimer
											</Button>
										</div>
									)}
								</td>
							)}
						</tr>
					))}
				</tbody>
			</table>

			<FormModal
				open={dialogue !== null}
				onClose={() => {
					setDialogue(null);
					setErreur(null);
				}}
				title={
					dialogue?.type === "abonner"
						? `Abonnement — ${dialogue.nom}`
						: `Arrêter — ${dialogue?.nom ?? ""}`
				}
			>
				{dialogue && (
					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							if (dialogue.type === "abonner")
								abonner.mutate({
									eleveId,
									typeFraisId: dialogue.typeFraisId,
									moisDebut: dialogue.mois,
								});
							else
								arreter.mutate({
									eleveId,
									typeFraisId: dialogue.typeFraisId,
									moisFin: dialogue.mois,
								});
						}}
					>
						<div>
							<label htmlFor="service-mois" className="mb-1 block text-sm font-medium">
								{dialogue.type === "abonner" ? "À partir de" : "Dernier mois"}
							</label>
							<select
								id="service-mois"
								className={CHAMP}
								value={dialogue.mois}
								onChange={(e) => setDialogue({ ...dialogue, mois: Number(e.target.value) })}
							>
								{MOIS_SERVICE.filter(
									(m) =>
										dialogue.type === "abonner" ||
										(ordreScolaire(m) >= ordreScolaire(dialogue.debut) &&
											ordreScolaire(m) <= ordreScolaire(DERNIER_MOIS_SERVICE)),
								).map((m) => (
									<option key={m} value={m}>
										{MOIS_LABELS[m]}
									</option>
								))}
							</select>
						</div>
						{erreur && <p className="text-sm text-danger">{erreur}</p>}
						<div className="flex justify-end gap-2">
							<Button type="button" variant="ghost" onClick={() => setDialogue(null)}>
								Annuler
							</Button>
							<Button type="submit" disabled={enCours}>
								{enCours ? "Enregistrement..." : "Enregistrer"}
							</Button>
						</div>
					</form>
				)}
			</FormModal>
		</section>
	);
}
