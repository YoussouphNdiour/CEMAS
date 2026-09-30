import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface StatCardProps {
	title: string;
	value: string | number;
	icon: LucideIcon;
	trend?: string;
	trendUp?: boolean;
}

export function StatCard({ title, value, icon: Icon, trend, trendUp }: StatCardProps) {
	return (
		<div className="rounded-xl border bg-surface p-5 shadow-sm">
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<p className="text-sm text-muted">{title}</p>
					<p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
					{trend && (
						<p
							className={cn(
								"mt-1 text-xs font-medium",
								trendUp ? "text-success" : "text-danger",
							)}
						>
							{trendUp ? "↑" : "↓"} {trend}
						</p>
					)}
				</div>
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-light">
					<Icon className="h-5 w-5 text-primary" />
				</div>
			</div>
		</div>
	);
}
