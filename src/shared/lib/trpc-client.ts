import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "./root-router";

export const trpc = createTRPCReact<AppRouter>();
