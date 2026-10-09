import { execFile } from "node:child_process";
import { readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { TRPCError } from "@trpc/server";
import { choisirDerniereSauvegarde } from "./fenetre";

const executer = promisify(execFile);
const bin = (nom: string) =>
	process.env.PG_BIN_DIR ? path.join(process.env.PG_BIN_DIR, nom) : nom;
const horodatage = (d = new Date()) =>
	d.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

export async function derniereSauvegarde() {
	const dossier = process.env.BACKUP_DIR;
	if (!dossier) return null;
	let noms: string[];
	try {
		noms = await readdir(dossier);
	} catch {
		return null;
	}
	const fichiers = await Promise.all(
		noms.map(async (nom) => {
			const s = await stat(path.join(dossier, nom));
			return { nom, mtime: s.mtime, taille: s.size };
		}),
	);
	const d = choisirDerniereSauvegarde(fichiers);
	return d ? { nom: d.nom, date: d.mtime.toISOString(), taille: d.taille } : null;
}

/** pg_dump -Fc de la base vers BACKUP_DIR, vérifié par pg_restore -l. */
export async function sauvegarder(prefixe: "cemas" | "prepassage") {
	const dossier = process.env.BACKUP_DIR;
	const url = process.env.DATABASE_URL;
	if (!dossier || !url) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Sauvegardes non configurées sur ce serveur.",
		});
	}
	const fichier = path.join(dossier, `${prefixe}-${horodatage()}.dump`);
	const tmp = `${fichier}.tmp`;
	try {
		await executer(bin("pg_dump"), ["-Fc", "-f", tmp, url], { timeout: 300_000 });
		await executer(bin("pg_restore"), ["-l", tmp], { timeout: 60_000 });
		await rename(tmp, fichier);
	} catch (e) {
		await rm(tmp, { force: true });
		const detail = e instanceof Error ? e.message.split("\n")[0] : String(e);
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: `Échec de la sauvegarde : ${detail}`,
		});
	}
	const s = await stat(fichier);
	return { nom: path.basename(fichier), taille: s.size };
}
