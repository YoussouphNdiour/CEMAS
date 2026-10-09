import { defineConfig, devices } from "@playwright/test";

// Port du serveur de test (E2E_PORT si le 3000 est déjà pris par une autre application)
const port = process.env.E2E_PORT ?? "3000";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: "html",
	timeout: 60_000,
	use: {
		baseURL: `http://localhost:${port}`,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: `pnpm dev --port ${port}`,
		url: `http://localhost:${port}/login`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
