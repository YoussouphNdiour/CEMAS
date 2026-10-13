import type { LigneBilan, TotauxBilan } from "@/modules/finance/bilan";
import type { Comptabilite } from "./comptabilite";

export type RapportComptable = Comptabilite & { du: string; au: string };

export interface RapportEtablissement {
	annee: { libelle: string; dateDebut: string; dateFin: string };
	effectifs: {
		niveau: string;
		classe: string;
		capacite: number;
		garcons: number;
		filles: number;
		total: number;
	}[];
	bilan: { lignes: LigneBilan[]; totaux: TotauxBilan };
	impayes: {
		totalDu: number;
		totalPaye: number;
		totalReste: number;
		parClasse: { classe: string; reste: number; eleves: number }[];
		parNiveau: { niveau: string; reste: number; eleves: number }[];
		top: { eleve: string; classe: string; reste: number }[];
	};
	reductions: { parType: { type: string; nombre: number }[]; montantTotal: number };
	personnel: {
		parType: { type: string; nombre: number }[];
		masseMensuelle: number;
		salairesPayes: number;
	};
	transport: {
		vehicules: { immatriculation: string; capacite: number }[];
		itineraires: number;
		eleves: number;
	};
}
