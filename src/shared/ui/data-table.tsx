"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { EmptyState } from "@/shared/ui/empty-state";

export interface Column<T> {
	key: string;
	label: string;
	render?: (row: T) => React.ReactNode;
	sortable?: boolean;
}

interface DataTableProps<T> {
	columns: Column<T>[];
	data: T[];
	searchPlaceholder?: string;
	pageSize?: number;
	onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, unknown>>({
	columns,
	data,
	searchPlaceholder = "Rechercher...",
	pageSize = 10,
	onRowClick,
}: DataTableProps<T>) {
	const [search, setSearch] = useState("");
	const [sortKey, setSortKey] = useState<string | null>(null);
	const [sortAsc, setSortAsc] = useState(true);
	const [page, setPage] = useState(0);

	const filtered = useMemo(() => {
		if (!search.trim()) return data;
		const q = search.toLowerCase();
		return data.filter((row) =>
			columns.some((col) => {
				const val = row[col.key];
				return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
			}),
		);
	}, [data, search, columns]);

	const sorted = useMemo(() => {
		if (!sortKey) return filtered;
		return [...filtered].sort((a, b) => {
			const aVal = a[sortKey];
			const bVal = b[sortKey];
			if (aVal === bVal) return 0;
			if (aVal === null || aVal === undefined) return 1;
			if (bVal === null || bVal === undefined) return -1;
			const cmp = String(aVal).localeCompare(String(bVal), "fr", { numeric: true });
			return sortAsc ? cmp : -cmp;
		});
	}, [filtered, sortKey, sortAsc]);

	const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
	const safePage = Math.min(page, totalPages - 1);
	const paginated = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);

	function handleSort(key: string) {
		if (sortKey === key) {
			setSortAsc((prev) => !prev);
		} else {
			setSortKey(key);
			setSortAsc(true);
		}
		setPage(0);
	}

	function handleSearch(value: string) {
		setSearch(value);
		setPage(0);
	}

	return (
		<div className="rounded-xl border bg-surface shadow-sm">
			{/* Search bar */}
			<div className="border-b px-4 py-3">
				<div className="relative max-w-sm">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
					<input
						type="text"
						placeholder={searchPlaceholder}
						value={search}
						onChange={(e) => handleSearch(e.target.value)}
						className="w-full rounded-lg border border-gray-300 bg-transparent py-2 pl-9 pr-3 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>
			</div>

			{/* Table */}
			<div className="overflow-x-auto">
				<table className="w-full text-left text-sm">
					<thead>
						<tr className="border-b bg-gray-50">
							{columns.map((col) => (
								<th
									key={col.key}
									className={cn(
										"whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted",
										col.sortable && "cursor-pointer select-none hover:text-gray-900",
									)}
									onClick={col.sortable ? () => handleSort(col.key) : undefined}
								>
									<span className="inline-flex items-center gap-1">
										{col.label}
										{col.sortable && sortKey === col.key && <span>{sortAsc ? "↑" : "↓"}</span>}
									</span>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{paginated.length === 0 ? (
							<tr>
								<td colSpan={columns.length} className="px-4 py-8">
									<EmptyState
										title="Aucun résultat"
										description="Essayez de modifier votre recherche."
									/>
								</td>
							</tr>
						) : (
							paginated.map((row, i) => (
								<tr
									key={i}
									onClick={onRowClick ? () => onRowClick(row) : undefined}
									className={cn(
										"border-b transition last:border-b-0",
										onRowClick && "cursor-pointer hover:bg-gray-50",
									)}
								>
									{columns.map((col) => (
										<td key={col.key} className="whitespace-nowrap px-4 py-3">
											{col.render ? col.render(row) : (row[col.key] as React.ReactNode)}
										</td>
									))}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{/* Footer: results count + pagination */}
			<div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted">
				<span>
					{sorted.length} résultat{sorted.length !== 1 ? "s" : ""}
				</span>
				{totalPages > 1 && (
					<div className="flex items-center gap-2">
						<button
							onClick={() => setPage((p) => Math.max(0, p - 1))}
							disabled={safePage === 0}
							className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-gray-100 disabled:opacity-50"
						>
							<ChevronLeft className="h-4 w-4" />
							Préc.
						</button>
						<span className="text-xs">
							{safePage + 1} / {totalPages}
						</span>
						<button
							onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
							disabled={safePage >= totalPages - 1}
							className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-gray-100 disabled:opacity-50"
						>
							Suiv.
							<ChevronRight className="h-4 w-4" />
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
