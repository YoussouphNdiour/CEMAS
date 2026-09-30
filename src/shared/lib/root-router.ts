import { createTRPCRouter } from "./trpc";
import { academicRouter } from "@/modules/academic/router";
import { studentsRouter } from "@/modules/students/router";
import { payrollRouter } from "@/modules/payroll/router";
import { financeRouter } from "@/modules/finance/router";
import { transportRouter } from "@/modules/transport/router";
import { dashboardRouter } from "@/modules/dashboard/router";

export const appRouter = createTRPCRouter({
	academic: academicRouter,
	students: studentsRouter,
	payroll: payrollRouter,
	finance: financeRouter,
	transport: transportRouter,
	dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
