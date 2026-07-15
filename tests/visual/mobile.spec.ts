import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const routes = [
  { path: "/", name: "home", heading: /Good afternoon/ },
  { path: "/budget", name: "budget", heading: "Budget" },
  { path: "/activity", name: "activity", heading: "Activity" },
  { path: "/plan", name: "plan", heading: "Plan" },
  { path: "/settings", name: "settings", heading: "Settings" },
  { path: "/settings/imports", name: "imports", heading: "Import inbox" },
  { path: "/settings/diagnostics", name: "diagnostics", heading: "Reconciliation" },
] as const;

test.describe("390px mobile visual QA", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  });

  for (const route of routes) {
    test(`${route.name} renders without horizontal overflow`, async ({ page }, testInfo) => {
      await page.goto(route.path);
      await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await capture(page, testInfo, route.name);
    });
  }

  test("budget category sheet fits the viewport", async ({ page }, testInfo) => {
    await page.goto("/budget");
    await page.getByRole("button", { name: /Housing/ }).click();
    await expect(page.getByRole("region", { name: "Housing settings" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, "budget-category-sheet");
    await page.locator(".category-sheet").evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
    await capture(page, testInfo, "budget-category-sheet-actions");
  });

  test("Home category rows open matching category detail", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Housing/ }).click();
    await expect(page.getByRole("dialog", { name: "Housing category detail" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Housing category detail" })).toBeHidden();
  });

  test("transaction detail sheet exposes the full review workflow", async ({ page }, testInfo) => {
    await page.goto("/activity");
    await page.getByRole("button", { name: /Publix, Groceries/ }).click();
    const detail = page.getByRole("dialog", { name: /Publix transaction details/ });
    await expect(detail).toBeVisible();
    await expect(detail.getByText("Split transaction")).toBeVisible();
    await expect(detail.getByText("Mark reviewed")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, "activity-transaction-detail");
    await page.locator(".transaction-sheet").evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(detail.getByRole("button", { name: "Save transaction" })).toBeVisible();
    await capture(page, testInfo, "activity-transaction-detail-actions");
  });

  test("primary navigation uses accessible mobile touch targets", async ({ page }) => {
    await page.goto("/");
    for (const link of await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link").all()) {
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("Activity groups by day and review advances through Needs review", async ({ page }) => {
    await mockTransactionUpdates(page);
    await page.goto("/activity");
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Yesterday" })).toBeVisible();
    await page.getByRole("button", { name: "Needs review" }).click();
    await page.getByRole("button", { name: /Publix, Groceries/ }).click();
    await page.getByLabel("Mark reviewed").check();
    await page.getByRole("button", { name: "Save transaction" }).click();
    await expect(page.getByRole("dialog", { name: /Target transaction details/ })).toBeVisible();
    await page.getByLabel("Mark reviewed").check();
    await page.getByRole("button", { name: "Save transaction" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("0 transactions need review")).toBeVisible();
  });

  test("transaction swipes and visible menu expose review and category actions", async ({ page }) => {
    await mockTransactionUpdates(page);
    await page.goto("/activity");
    await page.getByRole("button", { name: "Needs review" }).click();
    const publix = page.getByRole("button", { name: /Publix, Groceries/ });
    await swipe(page, publix, 92, 2);
    await expect(publix).toBeHidden();
    await expect(page.getByRole("status")).toContainText("marked reviewed");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(publix).toBeVisible();

    await swipe(page, publix, 2, 92);
    await expect(publix).toBeVisible();
    await expect(page.getByRole("dialog", { name: /Choose category/ })).toHaveCount(0);

    await swipe(page, publix, -92, 2);
    await expect(page.getByRole("dialog", { name: /Choose category for Publix/ })).toBeVisible();
    await page.getByRole("button", { name: "Close category picker" }).click();
    await page.getByRole("button", { name: "Actions for Publix" }).click();
    await expect(page.getByRole("menuitem", { name: "Mark reviewed" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Change category" })).toBeVisible();
  });

  test("transaction sheet scroll is safe and handle drag dismisses", async ({ page }) => {
    await page.goto("/activity");
    await page.getByRole("button", { name: /Publix, Groceries/ }).click();
    const detail = page.getByRole("dialog", { name: /Publix transaction details/ });
    await page.locator(".transaction-sheet").evaluate((element) => { element.scrollTop = 180; });
    await expect(detail).toBeVisible();
    await page.locator(".transaction-sheet").evaluate((element) => { element.scrollTop = 0; });
    await swipe(page, page.getByRole("button", { name: "Drag down to close transaction details" }), 2, 140);
    await expect(detail).toBeHidden();
  });
});

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth, `page scroll width ${dimensions.scrollWidth}px exceeds ${dimensions.clientWidth}px`).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const directory = path.resolve("artifacts/visual");
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${name}-${testInfo.project.name}.png`), fullPage: true, animations: "disabled" });
}

async function mockTransactionUpdates(page: Page) {
  await page.route("**/api/transactions/**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "Transaction updated." }) }));
}

async function swipe(page: Page, locator: Locator, deltaX: number, deltaY: number) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Gesture target is not visible.");
  const startX = box.x + box.width / 2; const startY = box.y + Math.min(box.height / 2, 24);
  await page.mouse.move(startX, startY); await page.mouse.down(); await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 8 }); await page.mouse.up();
}
