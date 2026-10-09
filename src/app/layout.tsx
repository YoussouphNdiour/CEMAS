import type { Metadata } from "next";
import { Providers } from "@/shared/providers";
import "./globals.css";

export const metadata: Metadata = {
	title: "Gestion Ecole",
	description: "Gestion scolaire",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="fr">
			<body className="bg-background text-[#1a1a1a] antialiased">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
