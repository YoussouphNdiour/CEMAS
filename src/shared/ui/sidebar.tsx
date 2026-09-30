"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	LayoutDashboard,
	BookOpen,
	Users,
	Banknote,
	Bus,
	Briefcase,
	Settings,
	GraduationCap,
	ChevronDown,
	X,
	Calendar,
	BookOpenCheck,
	CreditCard,
	TrendingUp,
	Receipt,
	DollarSign,
	FileText,
	Truck,
	MapPin,
	UserCheck,
	UserPlus,
	ClipboardList,
	History,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/shared/lib/utils";

interface SidebarProps {
	open: boolean;
	onClose: () => void;
}

interface NavItem {
	label: string;
	href?: string;
	icon: React.ElementType;
	children?: { label: string; href: string; icon: React.ElementType }[];
}

const navItems: NavItem[] = [
	{ label: "Tableau de bord", href: "/", icon: LayoutDashboard },
	{
		label: "Académique",
		icon: BookOpen,
		children: [
			{ label: "Années scolaires", href: "/academique/annees", icon: Calendar },
			{ label: "Classes", href: "/academique/classes", icon: BookOpenCheck },
			{ label: "Matières", href: "/academique/matieres", icon: ClipboardList },
		],
	},
	{ label: "Élèves", href: "/eleves", icon: Users },
	{
		label: "Finances",
		icon: Banknote,
		children: [
			{ label: "Paiements", href: "/finances/paiements", icon: CreditCard },
			{ label: "Suivi", href: "/finances/suivi", icon: TrendingUp },
			{ label: "Dépenses", href: "/finances/depenses", icon: Receipt },
			{ label: "Recettes", href: "/finances/recettes", icon: DollarSign },
			{ label: "Bilan", href: "/finances/bilan", icon: FileText },
		],
	},
	{
		label: "Transport",
		icon: Bus,
		children: [
			{ label: "Véhicules", href: "/transport/vehicules", icon: Truck },
			{ label: "Itinéraires", href: "/transport/itineraires", icon: MapPin },
			{ label: "Affectations", href: "/transport/affectations", icon: UserCheck },
		],
	},
	{
		label: "Payroll",
		icon: Briefcase,
		children: [
			{ label: "Employés", href: "/payroll/employes", icon: UserPlus },
			{ label: "Bulletins", href: "/payroll/bulletins", icon: FileText },
			{ label: "Historique", href: "/payroll/historique", icon: History },
		],
	},
	{ label: "Paramètres", href: "/parametres", icon: Settings },
];

export function Sidebar({ open, onClose }: SidebarProps) {
	const pathname = usePathname();
	const [expanded, setExpanded] = useState<string[]>([]);

	function toggleExpand(label: string) {
		setExpanded((prev) =>
			prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
		);
	}

	function isActive(href: string) {
		if (href === "/") return pathname === "/";
		return pathname.startsWith(href);
	}

	return (
		<>
			{/* Mobile overlay */}
			{open && (
				<div
					className="fixed inset-0 z-40 bg-black/50 lg:hidden"
					onClick={onClose}
					onKeyDown={() => {}}
				/>
			)}

			<aside
				className={cn(
					"fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col bg-primary text-white transition-transform duration-200",
					!open && "-translate-x-full lg:translate-x-0",
				)}
			>
				{/* Logo */}
				<div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
							<GraduationCap className="h-6 w-6 text-primary" />
						</div>
						<div>
							<h1 className="text-lg font-bold">CEMAS</h1>
							<p className="text-xs text-white/60">Gestion Scolaire</p>
						</div>
					</div>
					<button className="lg:hidden" onClick={onClose}>
						<X className="h-5 w-5" />
					</button>
				</div>

				{/* Navigation */}
				<nav className="flex-1 overflow-y-auto px-3 py-4">
					<ul className="space-y-1">
						{navItems.map((item) => {
							const hasChildren = item.children && item.children.length > 0;
							const isExpanded = expanded.includes(item.label);
							const itemActive = item.href
								? isActive(item.href)
								: item.children?.some((c) => isActive(c.href));

							return (
								<li key={item.label}>
									{hasChildren ? (
										<>
											<button
												onClick={() => toggleExpand(item.label)}
												className={cn(
													"flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-white/10",
													itemActive && "bg-white/10",
												)}
											>
												<item.icon className="h-5 w-5" />
												<span className="flex-1 text-left">{item.label}</span>
												<ChevronDown
													className={cn(
														"h-4 w-4 transition",
														isExpanded && "rotate-180",
													)}
												/>
											</button>
											{isExpanded && (
												<ul className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-3">
													{item.children!.map((child) => (
														<li key={child.href}>
															<Link
																href={child.href}
																onClick={onClose}
																className={cn(
																	"flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-white/10",
																	isActive(child.href) &&
																		"bg-white/15 font-medium",
																)}
															>
																<child.icon className="h-4 w-4" />
																{child.label}
															</Link>
														</li>
													))}
												</ul>
											)}
										</>
									) : (
										<Link
											href={item.href!}
											onClick={onClose}
											className={cn(
												"flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-white/10",
												isActive(item.href!) && "bg-white/15 border-l-2 border-secondary",
											)}
										>
											<item.icon className="h-5 w-5" />
											{item.label}
										</Link>
									)}
								</li>
							);
						})}
					</ul>
				</nav>
			</aside>
		</>
	);
}
