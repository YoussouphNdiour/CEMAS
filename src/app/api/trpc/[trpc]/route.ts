import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/shared/lib/root-router";
import { createTRPCContext } from "@/shared/lib/trpc";

const handler = (req: Request) =>
	fetchRequestHandler({
		endpoint: "/api/trpc",
		req,
		router: appRouter,
		createContext: createTRPCContext,
	});

export { handler as GET, handler as POST };
