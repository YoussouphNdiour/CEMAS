import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "./db";
import { users } from "@/modules/auth/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

export const { handlers, auth, signIn, signOut } = NextAuth({
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

				const valid = await bcrypt.compare(
					credentials.password as string,
					user.passwordHash,
				);
				if (!valid) return null;

				return { id: user.id, email: user.email, name: user.nom };
			},
		}),
	],
	session: { strategy: "jwt" },
	pages: { signIn: "/login" },
	callbacks: {
		jwt({ token, user }) {
			if (user) {
				token.id = user.id;
			}
			return token;
		},
		session({ session, token }) {
			if (session.user) {
				session.user.id = token.id as string;
			}
			return session;
		},
	},
});
