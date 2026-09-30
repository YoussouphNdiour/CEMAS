import { cn } from "@/shared/lib/utils";

interface StatusBadgeProps {
	status: string;
}

const colorMap: Record<string, string> = {
	actif: "bg-green-100 text-green-800",
	confirmee: "bg-green-100 text-green-800",
	paye: "bg-green-100 text-green-800",
	inactif: "bg-gray-100 text-gray-800",
	impaye: "bg-yellow-100 text-yellow-800",
	en_attente: "bg-yellow-100 text-yellow-800",
	transfere: "bg-blue-100 text-blue-800",
	danger: "bg-red-100 text-red-800",
};

function getColorClass(status: string): string {
	const key = status.toLowerCase().replace(/\s+/g, "_");
	return colorMap[key] ?? "bg-gray-100 text-gray-800";
}

export function StatusBadge({ status }: StatusBadgeProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
				getColorClass(status),
			)}
		>
			{status.replace(/_/g, " ")}
		</span>
	);
}
