"use client";

export type Relation = "pere" | "mere" | "tuteur";

export interface ContactForm {
	prenom: string;
	nom: string;
	telephone: string;
	telephone2: string;
	profession: string;
	adresse: string;
	relation: Relation;
}

export const CONTACT_VIDE: ContactForm = {
	prenom: "",
	nom: "",
	telephone: "",
	telephone2: "",
	profession: "",
	adresse: "",
	relation: "pere",
};

export const RELATION_LABELS: Record<Relation, string> = {
	pere: "Père",
	mere: "Mère",
	tuteur: "Tuteur",
};

const INPUT =
	"w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

interface ContactFieldsProps {
	/** Préfixe unique des id/name (plusieurs blocs sur la même page). */
	idPrefix: string;
	value: ContactForm;
	onChange: (value: ContactForm) => void;
}

/** Champs d'un parent / contact (inscription et ajout d'un 2e contact). */
export function ContactFields({ idPrefix, value, onChange }: ContactFieldsProps) {
	const set = (patch: Partial<ContactForm>) => onChange({ ...value, ...patch });
	const id = (field: string) => `${idPrefix}-${field}`;

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-2 gap-4">
				<div>
					<label htmlFor={id("prenom")} className="mb-1 block text-sm font-medium">
						Prénom *
					</label>
					<input
						id={id("prenom")}
						type="text"
						value={value.prenom}
						onChange={(e) => set({ prenom: e.target.value })}
						className={INPUT}
						required
					/>
				</div>
				<div>
					<label htmlFor={id("nom")} className="mb-1 block text-sm font-medium">
						Nom *
					</label>
					<input
						id={id("nom")}
						type="text"
						value={value.nom}
						onChange={(e) => set({ nom: e.target.value })}
						className={INPUT}
						required
					/>
				</div>
			</div>
			<div className="grid grid-cols-2 gap-4">
				<div>
					<label htmlFor={id("telephone")} className="mb-1 block text-sm font-medium">
						Téléphone *
					</label>
					<input
						id={id("telephone")}
						type="tel"
						value={value.telephone}
						onChange={(e) => set({ telephone: e.target.value })}
						className={INPUT}
						placeholder="77 123 45 67"
						required
					/>
				</div>
				<div>
					<label htmlFor={id("telephone2")} className="mb-1 block text-sm font-medium">
						Téléphone 2
					</label>
					<input
						id={id("telephone2")}
						type="tel"
						value={value.telephone2}
						onChange={(e) => set({ telephone2: e.target.value })}
						className={INPUT}
					/>
				</div>
			</div>
			<div>
				<label htmlFor={id("profession")} className="mb-1 block text-sm font-medium">
					Profession
				</label>
				<input
					id={id("profession")}
					type="text"
					value={value.profession}
					onChange={(e) => set({ profession: e.target.value })}
					className={INPUT}
				/>
			</div>
			<fieldset>
				<legend className="mb-1 block text-sm font-medium">Relation *</legend>
				<div className="flex gap-4">
					{(Object.keys(RELATION_LABELS) as Relation[]).map((r) => (
						<label key={r} className="flex items-center gap-2">
							<input
								type="radio"
								name={id("relation")}
								value={r}
								checked={value.relation === r}
								onChange={() => set({ relation: r })}
								className="accent-primary"
							/>
							{RELATION_LABELS[r]}
						</label>
					))}
				</div>
			</fieldset>
		</div>
	);
}

/** Un contact est renseigné quand ses champs obligatoires le sont. */
export function contactComplet(c: ContactForm): boolean {
	return Boolean(c.prenom.trim() && c.nom.trim() && c.telephone.trim());
}
