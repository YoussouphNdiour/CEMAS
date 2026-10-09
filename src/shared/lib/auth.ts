import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { users } from "@/modules/auth/schema";
import { authConfig } from "./auth.config";
import { db } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
	...authConfig,
	providers: [
		Credentials({
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Mot de passe", type: "password" },
			},
			authorize: async (credentials) => {
				if (!credentials?.email || !credentials?.password) return null;

				const [user] = await db
					.select()
					.from(users)
					.where(eq(users.email, credentials.email as string));

				if (!user) return null;

				const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
				if (!valid) return null;

				return { id: user.id, email: user.email, name: user.nom };
			},
		}),
	],
});
