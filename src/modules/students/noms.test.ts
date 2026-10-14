import { describe, expect, it } from "vitest";
import { normaliserNom } from "./noms";

describe("normaliserNom", () => {
	it("ignore casse, espaces multiples, tabulations et espaces insécables", () => {
		expect(normaliserNom("  Awa \tBINETA ")).toBe("awa bineta");
	});
	it("unifie les formes Unicode (NFD → NFC)", () => {
		expect(normaliserNom("Kébé")).toBe(normaliserNom("Kébé"));
	});
});
