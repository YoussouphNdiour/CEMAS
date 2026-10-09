"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { trpc } from "@/shared/lib/trpc-client";

export default function LoginPage() {
	const router = useRouter();
	const ecole = trpc.settings.public.useQuery();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);

		const result = await signIn("credentials", {
			email,
			password,
			redirect: false,
		});

		if (result?.error) {
			setError("Email ou mot de passe incorrect");
			setLoading(false);
		} else {
			router.push("/");
			router.refresh();
		}
	}

	return (
		<div className="w-full max-w-md rounded-2xl bg-surface p-8 shadow-xl">
			<div className="mb-8 text-center">
				<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
					<GraduationCap className="h-8 w-8 text-primary" />
				</div>
				<h1 className="text-2xl font-bold text-primary">Gestion Ecole</h1>
				<p className="text-sm text-muted">{ecole.data?.nom ?? "\u00a0"}</p>
			</div>

			<form onSubmit={handleSubmit} className="space-y-4">
				{error && (
					<div className="rounded-lg bg-red-50 p-3 text-sm text-danger">{error}</div>
				)}
				<div>
					<label htmlFor="email" className="mb-1 block text-sm font-medium">
						Email
					</label>
					<input
						id="email"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						placeholder="directeur@cemas.sn"
						required
					/>
				</div>
				<div>
					<label htmlFor="password" className="mb-1 block text-sm font-medium">
						Mot de passe
					</label>
					<input
						id="password"
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						required
					/>
				</div>
				<button
					type="submit"
					disabled={loading}
					className="w-full rounded-lg bg-primary py-2.5 font-medium text-white transition hover:bg-primary-hover disabled:opacity-50"
				>
					{loading ? "Connexion..." : "Se connecter"}
				</button>
			</form>
		</div>
	);
}
