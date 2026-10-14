import { academicRouter } from "@/modules/academic/router";
import { auditRouter } from "@/modules/audit/router";
import { dashboardRouter } from "@/modules/dashboard/router";
import { financeRouter } from "@/modules/finance/router";
import { payrollRouter } from "@/modules/payroll/router";
import { reportsRouter } from "@/modules/reports/router";
import { settingsRouter } from "@/modules/settings/router";
import { studentsRouter } from "@/modules/students/router";
import { transportRouter } from "@/modules/transport/router";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
	academic: academicRouter,
	students: studentsRouter,
	payroll: payrollRouter,
	finance: financeRouter,
	transport: transportRouter,
	dashboard: dashboardRouter,
	settings: settingsRouter,
	reports: reportsRouter,
	audit: auditRouter,
});

export type AppRouter = typeof appRouter;
