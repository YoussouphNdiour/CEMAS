"use client";

import { X } from "lucide-react";

interface FormModalProps {
	open: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
}

export function FormModal({ open, onClose, title, children }: FormModalProps) {
	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="form-modal-title"
				className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-surface shadow-xl"
			>
				<div className="flex items-center justify-between border-b px-6 py-4">
					<h2 id="form-modal-title" className="text-lg font-semibold text-gray-900">
						{title}
					</h2>
					<button
						type="button"
						aria-label="Fermer"
						onClick={onClose}
						className="rounded-lg p-1.5 text-muted transition hover:bg-gray-100 hover:text-gray-900"
					>
						<X className="h-5 w-5" />
					</button>
				</div>
				<div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
			</div>
		</div>
	);
}
