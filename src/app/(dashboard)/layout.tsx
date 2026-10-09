"use client";

import { useState } from "react";
import { Header } from "@/shared/ui/header";
import { Sidebar } from "@/shared/ui/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	const [sidebarOpen, setSidebarOpen] = useState(false);

	return (
		<div className="flex min-h-screen">
			<Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
			<div className="flex flex-1 flex-col lg:ml-[260px]">
				<Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
				<main className="flex-1 bg-background p-6">{children}</main>
			</div>
		</div>
	);
}
