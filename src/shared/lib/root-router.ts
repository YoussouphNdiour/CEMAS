import { createTRPCRouter } from "./trpc";

// Module routers will be merged here as they are created
export const appRouter = createTRPCRouter({});

export type AppRouter = typeof appRouter;
