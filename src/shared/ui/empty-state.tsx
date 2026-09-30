import { Inbox } from "lucide-react";

interface EmptyStateProps {
	title: string;
	description?: string;
	action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
				<Inbox className="h-7 w-7 text-muted" />
			</div>
			<h3 className="mt-4 text-base font-semibold text-gray-900">{title}</h3>
			{description && <p className="mt-1 text-sm text-muted">{description}</p>}
			{action && <div className="mt-4">{action}</div>}
		</div>
	);
}
