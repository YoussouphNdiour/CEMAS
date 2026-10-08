"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { Button } from "@/shared/ui";

const INPUT =
	"w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

type FormState = {
	nom: string;
	sigle: string;
	adresse: string;
	telephone1: string;
	telephone2: string;
	email: string;
	contactsEntete: string;
	prefixeMatricule: string;
	prefixeRecu: string;
	prefixeEmploye: string;
};

const FIELDS: { key: keyof FormState; label: string; type?: string }[] = [
	{ key: "nom", label: "Nom de l'établissement" },
	{ key: "sigle", label: "Sigle" },
	{ key: "adresse", label: "Adresse" },
	{ key: "telephone1", label: "Téléphone 1", type: "tel" },
	{ key: "telephone2", label: "Téléphone 2", type: "tel" },
	{ key: "email", label: "Email", type: "email" },
	{ key: "contactsEntete", label: "Ligne de contacts (en-têtes)" },
	{ key: "prefixeMatricule", label: "Préfixe matricule élève" },
	{ key: "prefixeRecu", label: "Préfixe reçu" },
	{ key: "prefixeEmploye", label: "Préfixe matricule employé" },
];

export function ParametresForm() {
	const utils = trpc.useUtils();
	const parametres = trpc.settings.get.useQuery();
	const [form, setForm] = useState<FormState | null>(null);
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		if (parametres.data && !form) {
			const d = parametres.data;
			setForm({
				nom: d.nom,
				sigle: d.sigle,
				adresse: d.adresse ?? "",
				telephone1: d.telephone1 ?? "",
				telephone2: d.telephone2 ?? "",
				email: d.email ?? "",
				contactsEntete: d.contactsEntete ?? "",
				prefixeMatricule: d.prefixeMatricule,
				prefixeRecu: d.prefixeRecu,
				prefixeEmploye: d.prefixeEmploye,
			});
		}
	}, [parametres.data, form]);

	const update = trpc.settings.update.useMutation({
		onSuccess: () => {
			setSaved(true);
			utils.settings.get.invalidate();
			utils.settings.public.invalidate();
		},
	});

	if (!form) return <p className="text-sm text-muted">Chargement...</p>;

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!form) return;
		setSaved(false);
		update.mutate(form);
	}

	const fieldErrors = update.error?.data?.zodError?.fieldErrors as
		| Record<string, string[] | undefined>
		| undefined;

	return (
		<form onSubmit={handleSubmit} noValidate className="space-y-4">
			<div className="grid gap-4 sm:grid-cols-2">
				{FIELDS.map((f) => (
					<div
						key={f.key}
						className={f.key === "nom" || f.key === "contactsEntete" ? "sm:col-span-2" : ""}
					>
						<label htmlFor={`param-${f.key}`} className="mb-1 block text-sm font-medium">
							{f.label}
						</label>
						<input
							id={`param-${f.key}`}
							type={f.type ?? "text"}
							value={form[f.key]}
							onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
							className={INPUT}
						/>
						{fieldErrors?.[f.key]?.[0] && (
							<p className="mt-1 text-xs text-danger">{fieldErrors[f.key]?.[0]}</p>
						)}
					</div>
				))}
			</div>
			<p className="text-xs text-muted">
				Les préfixes s'appliquent aux nouveaux identifiants uniquement ; les identifiants existants
				ne changent pas.
			</p>
			{update.error && !fieldErrors && <p className="text-sm text-danger">{update.error.message}</p>}
			{saved && <p className="text-sm text-success">Paramètres enregistrés</p>}
			<Button type="submit" disabled={update.isPending}>
				{update.isPending ? "Enregistrement..." : "Enregistrer"}
			</Button>
		</form>
	);
}
