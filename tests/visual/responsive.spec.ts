import { expect, test } from "@playwright/test";

const routes = ["/", "/budget", "/activity", "/plan", "/income"];

test.describe("required responsive viewports", () => {
  test("magic-link confirmation waits for explicit user action", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=test-token&type=email");
    await expect(page.getByRole("heading", { name: "One last step." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue to SPND" })).toBeVisible();
    await expect(page).toHaveURL(/token_hash=test-token/);
  });

  test("primary workflows have no horizontal overflow", async ({ page }) => {
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator(".app-frame > main")).toBeVisible();
      const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
      expect(dimensions.scrollWidth, `${route} overflowed`).toBeLessThanOrEqual(dimensions.clientWidth);
    }
  });

  test("transaction detail uses the viewport-appropriate wrapper", async ({ page }, testInfo) => {
    await page.goto("/activity");
    await page.getByRole("button", { name: /Publix, Groceries/ }).click();
    const inspector = page.locator(".transaction-sheet");
    const box = await inspector.boundingBox();
    const width = testInfo.project.use.viewport?.width ?? 390;
    if (width < 600) expect(box?.width ?? 0).toBeGreaterThanOrEqual(width - 17);
    if (width >= 900) { expect(box?.width ?? 9999).toBeLessThanOrEqual(520); expect((box?.x ?? 0) + (box?.width ?? 0)).toBeGreaterThanOrEqual(width - 1); }
    await expect(page.getByRole("button", { name: "Close transaction", exact: true })).toBeVisible();
  });
});
