interface PrintLayoutProps {
	children: React.ReactNode;
}

export function PrintLayout({ children }: PrintLayoutProps) {
	return (
		<div className="print-only">
			<div className="mb-6 border-b pb-4 text-center">
				<h1 className="text-xl font-bold">CEMAS - Complexe Educatif Mame Anta Sidibe</h1>
			</div>
			{children}
		</div>
	);
}
