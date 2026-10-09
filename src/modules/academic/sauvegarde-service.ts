import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { TRPCError } from "@trpc/server";
import { choisirDerniereSauvegarde } from "./fenetre";

const executer = promisify(execFile);
const bin = (nom: string) =>
	process.env.PG_BIN_DIR ? path.join(process.env.PG_BIN_DIR, nom) : nom;
const MOTIF = /^(cemas|prepassage)-[\w-]+\.dump$/;

/** Horodatage unique (ms + suffixe aléatoire) : deux sauvegardes simultanées n'écrivent jamais le même fichier. */
const horodatage = (d = new Date()) =>
	`${d.toISOString().replace(/[-:]/g, "").replace("T", "-").replace(".", "").slice(0, 18)}-${randomUUID().slice(0, 6)}`;

/** Connexion PostgreSQL par variables d'environnement (jamais l'URL ni le mot de passe en argument). */
export function envConnexion(url: string): Record<string, string> {
	const u = new URL(url);
	return {
		PGHOST: u.hostname,
		PGPORT: u.port || "5432",
		PGUSER: decodeURIComponent(u.username),
		PGPASSWORD: decodeURIComponent(u.password),
		PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, "")),
	};
}

/** Message lisible sans détail sensible : la ligne d'erreur de pg_dump / pg_restore. */
function messageErreur(e: unknown): string {
	const err = e as { code?: string | number; stderr?: string; killed?: boolean };
	if (err.code === "ENOENT") return "outil pg_dump introuvable sur le serveur";
	if (err.killed) return "délai dépassé";
	const ligne = (err.stderr ?? "")
		.split("\n")
		.map((l) => l.trim())
		.find((l) => /error|erreur|fatal/i.test(l));
	return (ligne ?? "erreur inconnue").replace(/postgres(ql)?:\/\/\S+/gi, "[connexion]");
}

export async function derniereSauvegarde() {
	const dossier = process.env.BACKUP_DIR;
	if (!dossier) return null;
	let noms: string[];
	try {
		noms = (await readdir(dossier)).filter((nom) => MOTIF.test(nom));
	} catch {
		return null;
	}
	// Un fichier peut être purgé entre readdir et stat : on l'ignore
	const fichiers = (
		await Promise.allSettled(
			noms.map(async (nom) => {
				const s = await stat(path.join(dossier, nom));
				return { nom, mtime: s.mtime, taille: s.size };
			}),
		)
	).flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
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
	const env = { ...process.env, ...envConnexion(url) };
	try {
		await executer(bin("pg_dump"), ["-Fc", "-f", tmp], { env, timeout: 300_000 });
		await executer(bin("pg_restore"), ["-l", tmp], { env, timeout: 60_000 });
		await rename(tmp, fichier);
	} catch (e) {
		await rm(tmp, { force: true });
		console.error("[sauvegarde] échec", messageErreur(e));
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: `Échec de la sauvegarde : ${messageErreur(e)}`,
		});
	}
	const s = await stat(fichier);
	return { nom: path.basename(fichier), taille: s.size };
}
