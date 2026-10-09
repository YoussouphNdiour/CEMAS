export function formatCFA(amount: number): string {
	return `${new Intl.NumberFormat("fr-SN", {
		style: "decimal",
		minimumFractionDigits: 0,
	}).format(amount)} FCFA`;
}

export function formatDate(date: Date | string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("fr-FR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

export function generateMatricule(prefix: string, year: number, seq: number): string {
	return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

export function generateRecuNumber(prefix: string, year: number, seq: number): string {
	return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

export function generateEmployeMatricule(prefix: string, seq: number): string {
	return `${prefix}-${String(seq).padStart(3, "0")}`;
}

export const MOIS_LABELS: Record<number, string> = {
	1: "Janvier",
	2: "Février",
	3: "Mars",
	4: "Avril",
	5: "Mai",
	6: "Juin",
	7: "Juillet",
	8: "Août",
	9: "Septembre",
	10: "Octobre",
	11: "Novembre",
	12: "Décembre",
};

export function cn(...classes: (string | false | undefined | null)[]): string {
	return classes.filter(Boolean).join(" ");
}
