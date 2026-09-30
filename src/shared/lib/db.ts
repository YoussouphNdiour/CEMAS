import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as authSchema from "@/modules/auth/schema";
import * as academicSchema from "@/modules/academic/schema";
import * as studentsSchema from "@/modules/students/schema";
import * as financeSchema from "@/modules/finance/schema";
import * as transportSchema from "@/modules/transport/schema";
import * as payrollSchema from "@/modules/payroll/schema";

const client = postgres(process.env.DATABASE_URL!);

export const db = drizzle(client, {
	schema: {
		...authSchema,
		...academicSchema,
		...studentsSchema,
		...financeSchema,
		...transportSchema,
		...payrollSchema,
	},
});
