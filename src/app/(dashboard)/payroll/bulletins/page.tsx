"use client";

import { useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { PageHeader, DataTable, StatusBadge, Button, MonthPicker, StatCard } from "@/shared/ui";
import type { Column } from "@/shared/ui";
import { formatCFA } from "@/shared/lib/utils";
import { FileText, CheckCircle, Banknote, Gift, MinusCircle, Users } from "lucide-react";

type BulletinRow = {
	id: string;
	employeId: string;
	mois: number;
	annee: number;
	salaireBase: number;
	primes: number;
	retenues: number;
	netAPayer: number;
	datePaiement: string | null;
	paye: boolean;
	note: string | null;
	employeMatricule: string;
	employePrenom: string;
	employeNom: string;
	employePoste: string;
};

export default function BulletinsPage() {
	const now = new Date();
	const [mois, setMois] = useState(now.getMonth() + 1);
	const [annee, setAnnee] = useState(now.getFullYear());
	const [editingCell, setEditingCell] = useState<{ id: string; field: "primes" | "retenues" } | null>(null);
	const [editValue, setEditValue] = useState("");

	const utils = trpc.useUtils();

	const bulletinsQuery = trpc.payroll.bulletins.list.useQuery({ mois, annee });
	const statsQuery = trpc.payroll.bulletins.stats.useQuery({ mois, annee });

	const generateMutation = trpc.payroll.bulletins.generate.useMutation({
		onSuccess: () => {
			utils.payroll.bulletins.list.invalidate();
			utils.payroll.bulletins.stats.invalidate();
		},
	});

	const updateMutation = trpc.payroll.bulletins.update.useMutation({
		onSuccess: () => {
			utils.payroll.bulletins.list.invalidate();
			utils.payroll.bulletins.stats.invalidate();
		},
	});

	const markPaidMutation = trpc.payroll.bulletins.markPaid.useMutation({
		onSuccess: () => {
			utils.payroll.bulletins.list.invalidate();
			utils.payroll.bulletins.stats.invalidate();
		},
	});

	function startEdit(id: string, field: "primes" | "retenues", currentValue: number) {
		setEditingCell({ id, field });
		setEditValue(String(currentValue));
	}

	function commitEdit(bulletin: BulletinRow) {
		if (!editingCell) return;
		const numValue = parseInt(editValue, 10) || 0;

		const primes = editingCell.field === "primes" ? numValue : bulletin.primes;
		const retenues = editingCell.field === "retenues" ? numValue : bulletin.retenues;

		updateMutation.mutate({
			id: bulletin.id,
			primes,
			retenues,
			note: bulletin.note ?? undefined,
		});

		setEditingCell(null);
		setEditValue("");
	}

	function handleKeyDown(e: React.KeyboardEvent, bulletin: BulletinRow) {
		if (e.key === "Enter") {
			commitEdit(bulletin);
		} else if (e.key === "Escape") {
			setEditingCell(null);
			setEditValue("");
		}
	}

	const stats = statsQuery.data;

	const columns: Column<BulletinRow>[] = [
		{
			key: "employeNom",
			label: "Employe",
			sortable: true,
			render: (row) => (
				<div>
					<div className="font-medium">{row.employePrenom} {row.employeNom}</div>
					<div className="text-xs text-muted">{row.employeMatricule} - {row.employePoste}</div>
				</div>
			),
		},
		{
			key: "salaireBase",
			label: "Salaire base",
			render: (row) => formatCFA(row.salaireBase),
		},
		{
			key: "primes",
			label: "Primes",
			render: (row) => {
				if (editingCell?.id === row.id && editingCell.field === "primes") {
					return (
						<input
							type="number"
							min={0}
							autoFocus
							value={editValue}
							onChange={(e) => setEditValue(e.target.value)}
							onBlur={() => commitEdit(row)}
							onKeyDown={(e) => handleKeyDown(e, row)}
							className="w-24 rounded border border-primary px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					);
				}
				return (
					<button
						onClick={(e) => {
							e.stopPropagation();
							if (!row.paye) startEdit(row.id, "primes", row.primes);
						}}
						className={`rounded px-2 py-1 text-sm transition ${row.paye ? "cursor-default" : "hover:bg-gray-100"}`}
						disabled={row.paye}
					>
						{formatCFA(row.primes)}
					</button>
				);
			},
		},
		{
			key: "retenues",
			label: "Retenues",
			render: (row) => {
				if (editingCell?.id === row.id && editingCell.field === "retenues") {
					return (
						<input
							type="number"
							min={0}
							autoFocus
							value={editValue}
							onChange={(e) => setEditValue(e.target.value)}
							onBlur={() => commitEdit(row)}
							onKeyDown={(e) => handleKeyDown(e, row)}
							className="w-24 rounded border border-primary px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					);
				}
				return (
					<button
						onClick={(e) => {
							e.stopPropagation();
							if (!row.paye) startEdit(row.id, "retenues", row.retenues);
						}}
						className={`rounded px-2 py-1 text-sm transition ${row.paye ? "cursor-default" : "hover:bg-gray-100"}`}
						disabled={row.paye}
					>
						{formatCFA(row.retenues)}
					</button>
				);
			},
		},
		{
			key: "netAPayer",
			label: "Net a payer",
			render: (row) => (
				<span className="font-semibold">{formatCFA(row.netAPayer)}</span>
			),
		},
		{
			key: "paye",
			label: "Statut",
			render: (row) => (
				<StatusBadge status={row.paye ? "paye" : "impaye"} />
			),
		},
		{
			key: "actions",
			label: "Actions",
			render: (row) =>
				!row.paye ? (
					<Button
						variant="outline"
						size="sm"
						onClick={(e) => {
							e.stopPropagation();
							markPaidMutation.mutate({ id: row.id });
						}}
						disabled={markPaidMutation.isPending}
					>
						<CheckCircle className="h-4 w-4" />
						Marquer paye
					</Button>
				) : (
					<span className="text-xs text-muted">
						Paye le {row.datePaiement}
					</span>
				),
		},
	];

	return (
		<div>
			<PageHeader
				title="Bulletins de paie"
				breadcrumbs={[{ label: "Paie" }, { label: "Bulletins" }]}
			/>

			{/* Controls */}
			<div className="mb-6 flex flex-wrap items-end gap-4">
				<div>
					<label className="mb-1 block text-sm font-medium text-gray-700">Mois</label>
					<MonthPicker value={mois} onChange={setMois} />
				</div>
				<div>
					<label className="mb-1 block text-sm font-medium text-gray-700">Annee</label>
					<input
						type="number"
						value={annee}
						onChange={(e) => setAnnee(parseInt(e.target.value, 10) || now.getFullYear())}
						className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						min={2020}
						max={2100}
					/>
				</div>
				<Button
					onClick={() => generateMutation.mutate({ mois, annee })}
					disabled={generateMutation.isPending}
				>
					<FileText className="h-4 w-4" />
					{generateMutation.isPending ? "Generation..." : "Generer les bulletins"}
				</Button>
			</div>

			{/* Stats */}
			{stats && (
				<div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard title="Total net a payer" value={formatCFA(stats.totalNet)} icon={Banknote} />
					<StatCard title="Total primes" value={formatCFA(stats.totalPrimes)} icon={Gift} />
					<StatCard title="Total retenues" value={formatCFA(stats.totalRetenues)} icon={MinusCircle} />
					<StatCard title="Nombre d'employes" value={String(stats.nbEmployes)} icon={Users} />
				</div>
			)}

			{/* Generation success message */}
			{generateMutation.isSuccess && generateMutation.data && (
				<div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
					{generateMutation.data.message}
				</div>
			)}

			<DataTable
				columns={columns}
				data={(bulletinsQuery.data as BulletinRow[]) ?? []}
				searchPlaceholder="Rechercher un employe..."
			/>
		</div>
	);
}
