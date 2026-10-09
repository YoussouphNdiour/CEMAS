"use client";

import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { etatCapacite } from "@/modules/academic/capacite";
import {
	CONTACT_VIDE,
	ContactFields,
	type ContactForm,
	contactComplet,
	RELATION_LABELS,
} from "@/modules/students/components/contact-fields";
import { trpc } from "@/shared/lib/trpc-client";
import { Button, ConfirmDialog, PageHeader } from "@/shared/ui";

export default function NouvelElevePage() {
	const router = useRouter();
	const [step, setStep] = useState(1);
	const [error, setError] = useState("");

	// Form data
	const [eleveData, setEleveData] = useState({
		prenom: "",
		nom: "",
		dateNaissance: "",
		lieuNaissance: "",
		sexe: "M" as "M" | "F",
		adresse: "",
		classeId: "",
	});

	const [parentData, setParentData] = useState<ContactForm>(CONTACT_VIDE);
	/** 2e contact optionnel (null = bloc fermé) */
	const [contact2, setContact2] = useState<ContactForm | null>(null);

	const annees = trpc.academic.annees.list.useQuery();
	const activeAnnee = annees.data?.find((a) => a.active);
	const niveaux = trpc.academic.niveaux.list.useQuery();
	const classesList = trpc.academic.classes.list.useQuery(
		{ anneeScolaireId: activeAnnee?.id ?? "" },
		{ enabled: !!activeAnnee?.id },
	);

	const createMutation = trpc.students.create.useMutation({
		onSuccess: (data) => {
			router.push(`/eleves/${data.id}`);
		},
		onError: (err) => {
			setError(err.message);
		},
	});

	const [selectedNiveau, setSelectedNiveau] = useState("");
	const filteredClasses = classesList.data?.filter(
		(c) => !selectedNiveau || c.niveauId === selectedNiveau,
	);

	function handleSuivant() {
		if (step === 2 && contact2 && !contactComplet(contact2)) {
			setError("Complétez le 2e contact (prénom, nom, téléphone) ou retirez-le.");
			return;
		}
		setError("");
		setStep(step + 1);
	}

	const [confirmPleine, setConfirmPleine] = useState(false);
	const classeChoisie = classesList.data?.find((c) => c.id === eleveData.classeId);
	const etatChoisie = classeChoisie
		? etatCapacite(classeChoisie.effectif, classeChoisie.capacite)
		: null;

	/** Classe pleine : l'inscription reste possible mais doit être confirmée. */
	function handleInscrire() {
		if (etatChoisie?.complete) {
			setConfirmPleine(true);
			return;
		}
		handleSubmit();
	}

	async function handleSubmit() {
		if (!activeAnnee) return;
		setConfirmPleine(false);
		setError("");
		createMutation.mutate({
			...eleveData,
			anneeScolaireId: activeAnnee.id,
			parent: parentData,
			parent2: contact2 ?? undefined,
		});
	}

	return (
		<div>
			<PageHeader
				title="Nouvelle inscription"
				breadcrumbs={[{ label: "Élèves", href: "/eleves" }, { label: "Nouvelle inscription" }]}
			/>

			{/* Steps indicator */}
			<div className="mb-8 flex items-center justify-center gap-4">
				{[1, 2, 3].map((s) => (
					<div key={s} className="flex items-center gap-2">
						<div
							className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
								s === step
									? "bg-primary text-white"
									: s < step
										? "bg-success text-white"
										: "bg-gray-200 text-muted"
							}`}
						>
							{s < step ? <Check className="h-4 w-4" /> : s}
						</div>
						<span className="text-sm font-medium">
							{s === 1 ? "Élève" : s === 2 ? "Parent" : "Classe"}
						</span>
						{s < 3 && <div className="h-px w-8 bg-gray-300" />}
					</div>
				))}
			</div>

			{error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-danger">{error}</div>}

			<div className="mx-auto max-w-2xl rounded-xl bg-surface p-6 shadow-sm">
				{/* Step 1: Info élève */}
				{step === 1 && (
					<div className="space-y-4">
						<h2 className="text-lg font-semibold">Informations de l&apos;élève</h2>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="mb-1 block text-sm font-medium">Prénom *</label>
								<input
									type="text"
									value={eleveData.prenom}
									onChange={(e) => setEleveData({ ...eleveData, prenom: e.target.value })}
									className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
									required
								/>
							</div>
							<div>
								<label className="mb-1 block text-sm font-medium">Nom *</label>
								<input
									type="text"
									value={eleveData.nom}
									onChange={(e) => setEleveData({ ...eleveData, nom: e.target.value })}
									className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
									required
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="mb-1 block text-sm font-medium">Date de naissance *</label>
								<input
									type="date"
									value={eleveData.dateNaissance}
									onChange={(e) =>
										setEleveData({
											...eleveData,
											dateNaissance: e.target.value,
										})
									}
									className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
									required
								/>
							</div>
							<div>
								<label className="mb-1 block text-sm font-medium">Lieu de naissance</label>
								<input
									type="text"
									value={eleveData.lieuNaissance}
									onChange={(e) =>
										setEleveData({
											...eleveData,
											lieuNaissance: e.target.value,
										})
									}
									className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
								/>
							</div>
						</div>
						<div>
							<label className="mb-1 block text-sm font-medium">Sexe *</label>
							<div className="flex gap-4">
								<label className="flex items-center gap-2">
									<input
										type="radio"
										name="sexe"
										value="M"
										checked={eleveData.sexe === "M"}
										onChange={() => setEleveData({ ...eleveData, sexe: "M" })}
										className="accent-primary"
									/>
									Masculin
								</label>
								<label className="flex items-center gap-2">
									<input
										type="radio"
										name="sexe"
										value="F"
										checked={eleveData.sexe === "F"}
										onChange={() => setEleveData({ ...eleveData, sexe: "F" })}
										className="accent-primary"
									/>
									Féminin
								</label>
							</div>
						</div>
						<div>
							<label className="mb-1 block text-sm font-medium">Adresse</label>
							<input
								type="text"
								value={eleveData.adresse}
								onChange={(e) => setEleveData({ ...eleveData, adresse: e.target.value })}
								className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
							/>
						</div>
					</div>
				)}

				{/* Step 2: Contacts */}
				{step === 2 && (
					<div className="space-y-4">
						<h2 className="text-lg font-semibold">Informations du parent / tuteur</h2>
						<ContactFields idPrefix="contact1" value={parentData} onChange={setParentData} />

						{contact2 ? (
							<fieldset
								aria-label="2e contact"
								className="space-y-3 rounded-lg border border-gray-200 p-4"
							>
								<div className="flex items-center justify-between">
									<span className="font-medium">2e contact</span>
									<Button variant="ghost" size="sm" onClick={() => setContact2(null)}>
										Retirer
									</Button>
								</div>
								<ContactFields idPrefix="contact2" value={contact2} onChange={setContact2} />
							</fieldset>
						) : (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setContact2({ ...CONTACT_VIDE, relation: "mere" })}
							>
								<Plus className="h-4 w-4" />
								Ajouter un 2e contact
							</Button>
						)}
					</div>
				)}

				{/* Step 3: Classe */}
				{step === 3 && (
					<div className="space-y-4">
						<h2 className="text-lg font-semibold">Choix de la classe</h2>
						<div>
							<label className="mb-1 block text-sm font-medium">Niveau</label>
							<select
								value={selectedNiveau}
								onChange={(e) => {
									setSelectedNiveau(e.target.value);
									setEleveData({ ...eleveData, classeId: "" });
								}}
								className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
							>
								<option value="">Tous les niveaux</option>
								{niveaux.data?.map((n) => (
									<option key={n.id} value={n.id}>
										{n.nom}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="mb-1 block text-sm font-medium">Classe *</label>
							<select
								value={eleveData.classeId}
								onChange={(e) => setEleveData({ ...eleveData, classeId: e.target.value })}
								className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
								required
							>
								<option value="">Sélectionner une classe</option>
								{filteredClasses?.map((c) => (
									<option key={c.id} value={c.id}>
										{c.nom} ({c.effectif}/{c.capacite}
										{c.effectif >= c.capacite ? ", complète" : ""})
									</option>
								))}
							</select>
							{classeChoisie && etatChoisie?.complete && (
								<p className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">
									Classe complète ({classeChoisie.effectif}/{classeChoisie.capacite}) : cette
									inscription dépassera la capacité.
								</p>
							)}
						</div>

						{/* Recap */}
						<div className="mt-6 rounded-lg bg-gray-50 p-4">
							<h3 className="mb-2 font-medium">Récapitulatif</h3>
							<div className="space-y-1 text-sm">
								<p>
									<span className="text-muted">Élève :</span> {eleveData.prenom} {eleveData.nom}
								</p>
								<p>
									<span className="text-muted">Parent :</span> {parentData.prenom} {parentData.nom}{" "}
									({RELATION_LABELS[parentData.relation]})
								</p>
								{contact2 && (
									<p>
										<span className="text-muted">2e contact :</span> {contact2.prenom}{" "}
										{contact2.nom} ({RELATION_LABELS[contact2.relation]})
									</p>
								)}
								<p>
									<span className="text-muted">Classe :</span>{" "}
									{filteredClasses?.find((c) => c.id === eleveData.classeId)?.nom || "—"}
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Navigation */}
				<div className="mt-6 flex justify-between">
					{step > 1 ? (
						<Button variant="ghost" onClick={() => setStep(step - 1)}>
							<ChevronLeft className="h-4 w-4" />
							Précédent
						</Button>
					) : (
						<div />
					)}
					{step < 3 ? (
						<Button onClick={handleSuivant}>
							Suivant
							<ChevronRight className="h-4 w-4" />
						</Button>
					) : (
						<Button
							onClick={handleInscrire}
							disabled={!eleveData.classeId || createMutation.isPending}
						>
							{createMutation.isPending ? "Inscription..." : "Inscrire l'élève"}
						</Button>
					)}
				</div>
			</div>

			<ConfirmDialog
				open={confirmPleine}
				onClose={() => setConfirmPleine(false)}
				onConfirm={handleSubmit}
				title="Inscrire quand même ?"
				message={`La classe ${classeChoisie?.nom ?? ""} est complète (${classeChoisie?.effectif ?? 0}/${classeChoisie?.capacite ?? 0}). L'élève sera inscrit au-delà de la capacité.`}
				confirmLabel="Inscrire quand même"
				loadingLabel="Inscription..."
				confirmVariant="primary"
				loading={createMutation.isPending}
			/>
		</div>
	);
}
