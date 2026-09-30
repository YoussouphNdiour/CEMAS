"use client";

import { Button } from "@/shared/ui/button";

interface ConfirmDialogProps {
	open: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title: string;
	message: string;
	loading?: boolean;
}

export function ConfirmDialog({
	open,
	onClose,
	onConfirm,
	title,
	message,
	loading,
}: ConfirmDialogProps) {
	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-xl">
				<h3 className="text-lg font-semibold text-gray-900">{title}</h3>
				<p className="mt-2 text-sm text-muted">{message}</p>
				<div className="mt-6 flex items-center justify-end gap-3">
					<Button variant="ghost" onClick={onClose} disabled={loading}>
						Annuler
					</Button>
					<Button variant="danger" onClick={onConfirm} disabled={loading}>
						{loading ? "Suppression..." : "Supprimer"}
					</Button>
				</div>
			</div>
		</div>
	);
}
