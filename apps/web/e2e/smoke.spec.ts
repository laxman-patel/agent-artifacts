import { expect, test } from "@playwright/test";

test.describe("web smoke", () => {
  test("landing page renders hero copy", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Every artifact your agent creates has a home/i })).toBeVisible();
    await expect(page.getByText("npx @agent-artifacts/cli@latest setup").first()).toBeVisible();
  });

  test("pricing page renders plan tiers", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: /Simple pricing for artifact hosting/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Builder" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pro" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();
  });

  test("login page exposes sign-in and sign-up tabs", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("tab", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Sign up" })).toBeVisible();
    await expect(page.getByRole("button", { name: /(?:Continue|Sign in) with Google/i })).toBeVisible();
    await page.getByRole("tab", { name: "Sign up" }).click();
    await expect(page.getByRole("heading", { name: /Sign up/i })).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
  });

  test("middleware redirects anonymous dashboard visits", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
