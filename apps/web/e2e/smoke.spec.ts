import { expect, test } from "@playwright/test";

test.describe("web smoke", () => {
  test("landing page renders hero copy", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Every artifact your agent creates has a home/i })).toBeVisible();
    await expect(page.getByText("npx agent-artifacts@latest setup").first()).toBeVisible();
  });

  test("login page exposes Google button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /Continue with Google/i })).toBeVisible();
  });

  test("middleware redirects anonymous dashboard visits", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
