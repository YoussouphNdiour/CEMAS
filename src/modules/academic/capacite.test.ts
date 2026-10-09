import { describe, expect, it } from "vitest";
import { etatCapacite } from "./capacite";

describe("etatCapacite", () => {
	it("indique les places restantes quand la classe n'est pas presque pleine", () => {
		expect(etatCapacite(11, 30)).toEqual({
			placesRestantes: 19,
			complete: false,
			depassement: 0,
			libelle: "19 places",
			ton: "ok",
		});
	});

	it("accorde au singulier", () => {
		expect(etatCapacite(19, 20).libelle).toBe("1 place");
	});

	it("passe en alerte à 10 % de places ou moins", () => {
		expect(etatCapacite(27, 30).ton).toBe("alerte");
		expect(etatCapacite(26, 30).ton).toBe("ok");
	});

	it("signale une classe complète", () => {
		expect(etatCapacite(30, 30)).toMatchObject({
			placesRestantes: 0,
			complete: true,
			depassement: 0,
			libelle: "Complète",
			ton: "pleine",
		});
	});

	it("signale un dépassement", () => {
		expect(etatCapacite(32, 30)).toMatchObject({
			placesRestantes: -2,
			complete: true,
			depassement: 2,
			libelle: "Dépassement : 2",
			ton: "pleine",
		});
	});
});
