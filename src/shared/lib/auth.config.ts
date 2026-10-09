import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const authConfig: NextAuthConfig = {
	providers: [
		Credentials({
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Mot de passe", type: "password" },
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
		authorized({ auth, request: { nextUrl } }) {
			const isLoggedIn = !!auth?.user;
			const isOnLogin = nextUrl.pathname === "/login";
			if (isOnLogin) {
				if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
				return true;
			}
			return isLoggedIn;
		},
	},
};
