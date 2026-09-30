"use client";

import { MOIS_LABELS } from "@/shared/lib/utils";

interface MonthPickerProps {
	value: number;
	onChange: (month: number) => void;
}

export function MonthPicker({ value, onChange }: MonthPickerProps) {
	return (
		<select
			value={value}
			onChange={(e) => onChange(Number(e.target.value))}
			className="rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm text-gray-900 transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
		>
			{Object.entries(MOIS_LABELS).map(([num, label]) => (
				<option key={num} value={num}>
					{label}
				</option>
			))}
		</select>
	);
}
