import Link from "next/link";

interface Breadcrumb {
	label: string;
	href?: string;
}

interface PageHeaderProps {
	title: string;
	breadcrumbs?: Breadcrumb[];
	action?: React.ReactNode;
}

export function PageHeader({ title, breadcrumbs, action }: PageHeaderProps) {
	return (
		<div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div>
				{breadcrumbs && breadcrumbs.length > 0 && (
					<nav className="mb-1 flex items-center gap-1 text-sm text-muted">
						{breadcrumbs.map((crumb, i) => (
							<span key={crumb.label} className="flex items-center gap-1">
								{i > 0 && <span className="mx-1">/</span>}
								{crumb.href ? (
									<Link
										href={crumb.href}
										className="transition hover:text-primary hover:underline"
									>
										{crumb.label}
									</Link>
								) : (
									<span>{crumb.label}</span>
								)}
							</span>
						))}
					</nav>
				)}
				<h1 className="text-2xl font-bold text-gray-900">{title}</h1>
			</div>
			{action && <div className="shrink-0">{action}</div>}
		</div>
	);
}
