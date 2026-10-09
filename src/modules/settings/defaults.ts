import type { ParametresEcole } from "./schema";

export type Parametres = Omit<ParametresEcole, "id" | "updatedAt">;

export const PARAMETRES_DEFAUT: Parametres = {
	nom: "Complexe Educatif Mame Anta Sidibe",
	sigle: "CEMAS",
	adresse: "Quartier Zac Ba, Thies, Senegal",
	telephone1: "77 300 08 31",
	telephone2: null,
	email: "admin@cemas.online",
	contactsEntete:
		"DG: M. Ndiour 77 300 08 31 | Dir. Elem.: M. Bass 77 521 37 19 | Dir. Presc.: Mme Cissokho 77 649 03 75",
	prefixeMatricule: "CEMAS",
	prefixeRecu: "REC",
	prefixeEmploye: "EMP",
};
