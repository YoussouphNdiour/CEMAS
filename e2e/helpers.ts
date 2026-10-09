import { expect, type Page } from "@playwright/test";

/** Login credentials: E2E_EMAIL / E2E_PASSWORD (CI uses the seed admin); defaults match the local dev DB */
export const CREDENTIALS = {
	email: process.env.E2E_EMAIL ?? "directeur@cemas.sn",
	password: process.env.E2E_PASSWORD ?? "cemas2025",
};

/** Login and wait for dashboard redirect */
export async function login(page: Page) {
	await page.goto("/login");
	await page.getByLabel("Email").fill(CREDENTIALS.email);
	await page.getByLabel("Mot de passe").fill(CREDENTIALS.password);
	await page.getByRole("button", { name: "Se connecter" }).click();
	// Wait for dashboard to load
	await page.waitForURL("/", { timeout: 15_000 });
	await expect(page.locator("body")).toBeVisible();
}

/** Wait for loading spinners / "Chargement..." to disappear */
export async function waitForLoad(page: Page) {
	await page.waitForTimeout(500);
	const loading = page.getByText("Chargement...");
	if (await loading.isVisible({ timeout: 1000 }).catch(() => false)) {
		await loading.waitFor({ state: "hidden", timeout: 15_000 });
	}
}

/** Click a button by its visible text */
export async function clickButton(page: Page, name: string) {
	await page.getByRole("button", { name }).click();
}

/** Fill a text/number input by its label */
export async function fillField(page: Page, label: string, value: string) {
	await page.getByLabel(label).fill(value);
}

/** Select an option by label and visible option text */
export async function selectOption(page: Page, label: string, optionText: string) {
	const select = page
		.locator(`select`)
		.filter({ has: page.locator(`..`).filter({ hasText: label }) });
	// Fallback: find by preceding label
	const labelEl = page.getByText(label, { exact: false });
	const container = labelEl.locator("..");
	const sel = container.locator("select");
	await sel.selectOption({ label: optionText });
}
