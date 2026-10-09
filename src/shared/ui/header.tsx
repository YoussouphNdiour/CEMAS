"use client";

import { LogOut, Menu, User } from "lucide-react";
import { signOut } from "next-auth/react";

interface HeaderProps {
	onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
	return (
		<header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-surface px-6">
			<div className="flex items-center gap-4">
				<button onClick={onMenuToggle} className="rounded-lg p-2 hover:bg-gray-100 lg:hidden">
					<Menu className="h-5 w-5" />
				</button>
			</div>

			<div className="flex items-center gap-4">
				<div className="flex items-center gap-2 text-sm">
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light">
						<User className="h-4 w-4 text-primary" />
					</div>
					<span className="hidden font-medium sm:inline">Directeur</span>
				</div>
				<button
					onClick={() => signOut({ callbackUrl: "/login" })}
					className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-gray-100 hover:text-danger"
				>
					<LogOut className="h-4 w-4" />
					<span className="hidden sm:inline">Déconnexion</span>
				</button>
			</div>
		</header>
	);
}
