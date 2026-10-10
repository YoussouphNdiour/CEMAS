import { chmod, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { envConnexion, sauvegarder } from "./sauvegarde-service";

describe("envConnexion", () => {
	it("passe la connexion par variables d'environnement, sans l'URL", () => {
		expect(envConnexion("postgresql://cemas:s3cret@db:5433/cemas_prod")).toMatchObject({
			PGHOST: "db",
			PGPORT: "5433",
			PGUSER: "cemas",
			PGPASSWORD: "s3cret",
			PGDATABASE: "cemas_prod",
		});
	});
	it("décode les caractères spéciaux du mot de passe", () => {
		expect(envConnexion("postgresql://u:p%40ss%21@h/db").PGPASSWORD).toBe("p@ss!");
	});
});

describe("sauvegarder (pg_dump simulé)", { timeout: 20_000 }, () => {
	const ancien = { ...process.env };
	let dossier: string;
	let bin: string;

	beforeEach(async () => {
		dossier = await mkdtemp(path.join(tmpdir(), "sauv-"));
		bin = await mkdtemp(path.join(tmpdir(), "bin-"));
		process.env.BACKUP_DIR = dossier;
		process.env.PG_BIN_DIR = bin;
		process.env.DATABASE_URL = "postgresql://cemas:TRES-SECRET@db:5432/cemas";
	});
	afterEach(() => {
		process.env = { ...ancien };
	});

	async function fauxBinaire(nom: string, script: string) {
		const f = path.join(bin, nom);
		await writeFile(f, `#!/bin/sh\n${script}\n`);
		await chmod(f, 0o755);
	}

	it("en cas d'échec : message de pg_dump, sans mot de passe ni URL, aucun fichier restant", async () => {
		await fauxBinaire("pg_dump", 'echo "pg_dump: error: connection refused" >&2; exit 1');
		await fauxBinaire("pg_restore", "exit 0");
		const erreur = await sauvegarder("cemas").catch((e: Error) => e);
		expect(erreur).toBeInstanceOf(Error);
		const message = (erreur as Error).message;
		expect(message).toContain("connection refused");
		expect(message).not.toContain("TRES-SECRET");
		expect(message).not.toContain("postgresql://");
		expect(await readdir(dossier)).toEqual([]);
	});

	it("deux sauvegardes simultanées : deux fichiers distincts", async () => {
		await fauxBinaire("pg_dump", 'while [ "$1" != "-f" ]; do shift; done; echo dump > "$2"');
		await fauxBinaire("pg_restore", "exit 0");
		const [a, b] = await Promise.all([sauvegarder("prepassage"), sauvegarder("prepassage")]);
		expect(a.nom).not.toBe(b.nom);
		expect((await readdir(dossier)).sort()).toEqual([a.nom, b.nom].sort());
	});

	it("n'expose pas l'URL dans les arguments de pg_dump", async () => {
		await fauxBinaire(
			"pg_dump",
			'echo "$@" > "$BACKUP_DIR/args.txt"; while [ "$1" != "-f" ]; do shift; done; echo dump > "$2"',
		);
		await fauxBinaire("pg_restore", "exit 0");
		await sauvegarder("cemas");
		const { readFile } = await import("node:fs/promises");
		const args = await readFile(path.join(dossier, "args.txt"), "utf8");
		expect(args).not.toContain("TRES-SECRET");
		expect(args).not.toContain("postgresql://");
	});
});
