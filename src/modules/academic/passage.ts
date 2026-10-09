export type Decision = "passe" | "redouble" | "quitte";
export type Resultat = "promu" | "redouble" | "sortant" | "depart";

export interface ClassePassage {
	id: string;
	nom: string;
	capacite: number;
	classeSuivanteId: string | null;
	finDeCycle: boolean;
}

export interface Mouvement {
	eleveId: string;
	classeSourceId: string;
	resultat: Resultat;
	/** Classe de l'année source dont la copie accueille l'élève (null = sort de l'école) */
	classeDestinationSourceId: string | null;
}

export interface PlanPassage {
	erreurs: string[];
	mouvements: Mouvement[];
	parClasse: {
		classeId: string;
		nom: string;
		promus: number;
		redoublants: number;
		sortants: number;
		departs: number;
	}[];
	effectifsPrevus: { classeSourceId: string; nom: string; effectif: number; capacite: number }[];
}

export function planifierPassage(p: {
	classes: ClassePassage[];
	eleves: { id: string; classeId: string }[];
	decisions: Record<string, Decision>;
}): PlanPassage {
	const parId = new Map(p.classes.map((c) => [c.id, c]));
	const erreurs: string[] = [];
	for (const c of p.classes) {
		if (c.finDeCycle) continue;
		if (!c.classeSuivanteId) erreurs.push(`${c.nom} : classe suivante non configurée`);
		else if (c.classeSuivanteId === c.id || !parId.has(c.classeSuivanteId))
			erreurs.push(`${c.nom} : classe suivante invalide`);
	}
	const parNom = new Map<string, number>();
	for (const c of p.classes) {
		const cle = c.nom.trim().toLocaleUpperCase("fr");
		parNom.set(cle, (parNom.get(cle) ?? 0) + 1);
	}
	for (const [nom, n] of parNom) {
		if (n > 1) erreurs.push(`Plusieurs classes nommées « ${nom} » : renommez-les avant le passage`);
	}
	const concernes = new Set(p.eleves.map((e) => e.id));
	for (const id of Object.keys(p.decisions)) {
		if (!concernes.has(id)) erreurs.push(`Décision pour un élève non concerné : ${id}`);
	}
	for (const e of p.eleves) {
		if (!parId.has(e.classeId)) erreurs.push(`Élève ${e.id} : classe hors de l'année`);
	}

	const parClasse = p.classes.map((c) => ({
		classeId: c.id,
		nom: c.nom,
		promus: 0,
		redoublants: 0,
		sortants: 0,
		departs: 0,
	}));
	const effectifs = new Map(p.classes.map((c) => [c.id, 0]));
	const vide = (): PlanPassage => ({
		erreurs,
		mouvements: [],
		parClasse,
		effectifsPrevus: p.classes.map((c) => ({
			classeSourceId: c.id,
			nom: c.nom,
			effectif: 0,
			capacite: c.capacite,
		})),
	});
	if (erreurs.length) return vide();

	const compte = new Map(parClasse.map((l) => [l.classeId, l]));
	const mouvements: Mouvement[] = p.eleves.map((e) => {
		const classe = parId.get(e.classeId) as ClassePassage;
		const decision = p.decisions[e.id] ?? "passe";
		const ligne = compte.get(classe.id) as (typeof parClasse)[number];
		let resultat: Resultat;
		let destination: string | null;
		if (decision === "quitte") {
			resultat = "depart";
			destination = null;
			ligne.departs++;
		} else if (decision === "redouble") {
			resultat = "redouble";
			destination = classe.id;
			ligne.redoublants++;
		} else if (classe.finDeCycle) {
			resultat = "sortant";
			destination = null;
			ligne.sortants++;
		} else {
			resultat = "promu";
			destination = classe.classeSuivanteId;
			ligne.promus++;
		}
		if (destination) effectifs.set(destination, (effectifs.get(destination) ?? 0) + 1);
		return {
			eleveId: e.id,
			classeSourceId: classe.id,
			resultat,
			classeDestinationSourceId: destination,
		};
	});

	return {
		erreurs,
		mouvements,
		parClasse,
		effectifsPrevus: p.classes.map((c) => ({
			classeSourceId: c.id,
			nom: c.nom,
			effectif: effectifs.get(c.id) ?? 0,
			capacite: c.capacite,
		})),
	};
}
