"use client";

import { trpc } from "@/shared/lib/trpc-client";

interface PrintLayoutProps {
	children: React.ReactNode;
}

export function PrintLayout({ children }: PrintLayoutProps) {
	const { data: ecole } = trpc.settings.get.useQuery();
	const telephones = [ecole?.telephone1, ecole?.telephone2].filter(Boolean).join(" / ");
	return (
		<div className="print-only">
			<div className="mb-6 border-b pb-4 text-center">
				<h1 className="text-xl font-bold">{ecole ? `${ecole.sigle} - ${ecole.nom}` : ""}</h1>
				{ecole?.adresse && <p className="text-sm">{ecole.adresse}</p>}
				{telephones && <p className="text-sm">Tél. : {telephones}</p>}
			</div>
			{children}
		</div>
	);
}
