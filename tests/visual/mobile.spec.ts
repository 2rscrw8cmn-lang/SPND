import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const routes = [
  { path: "/", name: "home", heading: /Good (morning|afternoon|evening)/ },
  { path: "/budget", name: "budget", heading: "Budget" },
  { path: "/activity", name: "activity", heading: "Activity" },
  { path: "/plan", name: "plan", heading: "Plan" },
  { path: "/income", name: "income", heading: "Income" },
  { path: "/settings", name: "settings", heading: "Settings" },
  { path: "/settings/diagnostics", name: "diagnostics", heading: "Reconciliation" },
] as const;

test.describe("390px mobile visual QA", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!["mobile-390", "mobile-430"].includes(testInfo.project.name), "Dedicated mobile workflow suite");
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

  test("Budget workspace and transaction-first category sheet fit the viewport", async ({ page }, testInfo) => {
    await page.goto("/budget");
    await expect(page.getByRole("navigation", { name: "Budget month" })).toContainText("Jul 2026");
    await page.getByRole("button", { name: "Edit budget" }).click();
    const budgetEditor = page.getByRole("dialog", { name: "Edit July budget" });
    await expect(budgetEditor).toBeVisible();
    const groceriesBudget = budgetEditor.getByLabel("Groceries monthly budget");
    await expect(groceriesBudget).toBeVisible();
    await groceriesBudget.fill("");
    await groceriesBudget.pressSequentially("125");
    await expect(groceriesBudget).toHaveValue("125");
    await expect(budgetEditor.getByRole("button", { name: "Save monthly budget" })).toBeVisible();
    await capture(page, testInfo, "budget-editor");
    await swipe(page, budgetEditor.getByRole("button", { name: "Drag down to close monthly budget editor" }), 2, 140);
    await expect(budgetEditor).toBeHidden();
    await expect(page.getByRole("button", { name: "Add category" })).toBeVisible();
    await page.getByRole("button", { name: /Groceries/ }).click();
    const detail = page.getByRole("dialog", { name: "Groceries category detail" });
    await expect(detail).toBeVisible();
    await expect(detail.getByText("Recent transactions")).toBeVisible();
    await expect(detail.getByText("Publix")).toBeVisible();
    await expect(detail.getByRole("button", { name: "Move money" })).toBeVisible();
    await expect(detail.getByText("Category settings", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, "budget-category-sheet");
    await page.locator(".category-sheet").evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(detail.getByText("Category settings", { exact: true })).toBeVisible();
    await capture(page, testInfo, "budget-category-sheet-actions");
  });

  test("a new budget month starts empty instead of reusing current transactions", async ({ page }) => {
    await page.goto("/budget");
    await page.getByRole("link", { name: "Aug" }).click();
    await expect(page.getByRole("navigation", { name: "Budget month" })).toContainText("Aug 2026");
    await page.getByRole("button", { name: /Groceries/ }).click();
    await expect(page.getByRole("dialog", { name: "Groceries category detail" }).getByText("No transactions in this month.")).toBeVisible();
  });

  test("Budget and Plan link to reconciled monthly Income", async ({ page }, testInfo) => {
    await page.goto("/budget");
    await page.getByRole("link", { name: "Income", exact: true }).click();
    await expect(page).toHaveURL(/\/income\?month=2026-07/);
    await expect(page.getByRole("heading", { level: 1, name: "Income" })).toBeVisible();
    await expect(page.getByText("$6,850.00")).toBeVisible();
    await expect(page.getByText(/\$3,425\.00 received/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Received" })).toBeVisible();
    await expect(page.getByText("Payroll", { exact: true })).toBeVisible();
    await expect(page.getByText("No unmatched deposits.")).toBeVisible();
    await capture(page, testInfo, "income");
    await page.goto("/plan");
    await page.getByRole("link", { name: /Next income/ }).click();
    await expect(page).toHaveURL(/\/income/);
  });

  test("Home category rows open matching category detail", async ({ page }) => {
    await page.goto("/");
    await page.locator(".budget-stack").getByRole("button", { name: /Groceries/ }).click();
    await expect(page.getByRole("dialog", { name: "Groceries category detail" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Groceries category detail" }).getByText("Publix")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Groceries category detail" })).toBeHidden();
  });

  test("category detail move updates totals and Undo restores the row", async ({ page }) => {
    await page.route("**/api/activity?transaction=t1", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transactions: [{ ...demoPublixDetail(), updatedAt: "2026-07-15T12:00:00.000Z" }] }) }));
    let revision = 0;
    await page.route("**/api/transactions/t1", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transaction: { updated_at: `2026-07-15T12:0${++revision}:00.000Z` } }) }));
    await page.goto("/budget");
    await page.getByRole("button", { name: /Groceries/ }).click();
    const detail = page.getByRole("dialog", { name: "Groceries category detail" });
    await detail.getByRole("button", { name: "Actions for Publix" }).click();
    await page.getByRole("menuitem", { name: "Change category" }).click();
    await page.getByRole("dialog", { name: "Choose category for Publix" }).getByRole("button", { name: /Dining/ }).click();
    await expect(detail.getByRole("button", { name: /Publix, Groceries/ })).toBeHidden();
    await expect(detail.getByText("$301.58", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(detail.getByRole("button", { name: /Publix, Groceries/ })).toBeVisible();
    await expect(detail.getByText("$388.00", { exact: true })).toBeVisible();
  });

  test("transaction detail sheet exposes the full review workflow", async ({ page }, testInfo) => {
    await page.goto("/activity");
    await page.getByRole("button", { name: /Publix, Groceries/ }).click();
    const detail = page.getByRole("dialog", { name: /Publix transaction details/ });
    await expect(detail).toBeVisible();
    await expect(detail.getByText("Split transaction")).toBeVisible();
    await expect(detail.getByText("Mark reviewed")).toBeVisible();
    await detail.getByRole("button", { name: "Edit merchant name" }).click();
    await expect(detail.getByLabel("Merchant display name")).toHaveValue("Publix");
    await detail.getByLabel("Merchant display name").fill("Publix Market");
    await detail.locator(".category-select-trigger").click();
    const picker = page.getByRole("dialog", { name: "Choose category for Publix" });
    await expect(picker.getByRole("button", { name: /Housing/ })).toBeVisible();
    await expect(picker.getByRole("button", { name: /Groceries/ })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(detail).toBeVisible();
    await expect(detail.getByText("Change history")).toBeVisible();
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

  test("reference-led mobile composition keeps primary information above the fold", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".hero-ring")).toBeVisible();
    await expect(page.getByText("safe today")).toBeVisible();
    const thirdHomeCategory = page.locator(".budget-stack .budget-row").nth(2);
    const homeBox = await thirdHomeCategory.boundingBox();
    expect((homeBox?.y ?? 9999) + (homeBox?.height ?? 0)).toBeLessThan(800);

    await page.goto("/budget");
    await expect(page.locator(".budget-summary-ring")).toBeVisible();
    await expect(page.getByText("expected income minus assigned")).toBeVisible();
    const budgetCategories = page.locator(".budget-page > .budget-group > .budget-list .budget-row");
    await expect(budgetCategories).toHaveCount(7);
    await expect(page.getByRole("button", { name: /Groceries/ })).toBeVisible();

    await page.goto("/activity");
    await expect(page.getByRole("heading", { level: 1, name: "Activity" })).toBeVisible();
    await page.getByRole("button", { name: "All activity" }).click();
    const firstTransaction = page.locator(".activity-day-card .transaction-row").first();
    await expect(firstTransaction).toBeVisible();
    const activityBox = await firstTransaction.boundingBox();
    expect(activityBox?.y ?? 9999).toBeLessThan(520);
    await page.goto("/budget");
    const categoryRadius = await page.locator(".category-disc").first().evaluate((element) => getComputedStyle(element).borderRadius);
    expect(categoryRadius).toBe("11px");
    const categoryBackground = await page.locator(".category-disc").first().evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(categoryBackground).toContain("linear-gradient");
  });

  test("Activity Review mode advances to all caught up", async ({ page }) => {
    await mockTransactionUpdates(page);
    await page.goto("/activity");
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Review 2/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /Publix, Groceries/ }).click();
    await page.getByLabel("Mark reviewed").check();
    await page.getByRole("button", { name: "Save transaction" }).click();
    await expect(page.getByRole("dialog", { name: /Target transaction details/ })).toBeVisible();
    await page.getByLabel("Mark reviewed").check();
    await page.getByRole("button", { name: "Save transaction" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "All caught up" })).toBeVisible();
  });

  test("Activity can review every visible transaction in a day at once", async ({ page }) => {
    await mockTransactionUpdates(page);
    await page.goto("/activity");
    const today = page.locator(".activity-day-group").filter({ has: page.getByRole("heading", { name: "Today" }) });
    await today.getByRole("button", { name: "Review 1" }).click();
    await expect(today).toBeHidden();
    await expect(page.getByRole("status")).toContainText("reviewed for the day");
  });

  test("transaction swipes and visible menu expose review and category actions", async ({ page }) => {
    await mockTransactionUpdates(page);
    await page.goto("/activity");
    await expect(page.getByRole("button", { name: /Review 2/ })).toHaveAttribute("aria-pressed", "true");
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
    await page.keyboard.press("Escape");
    const actions = page.getByRole("button", { name: "Actions for Publix" });
    await actions.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "Mark reviewed" })).toBeFocused();
    await expect(page.getByRole("dialog", { name: /Publix transaction details/ })).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(actions).toBeFocused();
  });

  test("transaction detail is full-screen and browser Back dismisses it", async ({ page }) => {
    await page.goto("/activity");
    await page.getByRole("button", { name: /Publix, Groceries/ }).click();
    const detail = page.getByRole("dialog", { name: /Publix transaction details/ });
    await page.locator(".transaction-sheet").evaluate((element) => { element.scrollTop = 180; });
    await expect(detail).toBeVisible();
    const box = await page.locator(".transaction-sheet").boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(840);
    await page.goBack();
    await expect(detail).toBeHidden();
  });

  test("odd-cent split defaults balance exactly", async ({ page }) => {
    await page.goto("/activity");
    await page.getByRole("button", { name: /Target, Unsorted/ }).click();
    const detail = page.getByRole("dialog", { name: /Target transaction details/ });
    await detail.getByRole("button", { name: "Split transaction" }).click();
    const values = await detail.locator('.split-row input').evaluateAll((inputs) => inputs.map((input) => Number((input as HTMLInputElement).value)));
    expect(Math.round(values.reduce((sum, value) => sum + value, 0) * 100)).toBe(7421);
    await expect(detail.locator(".split-total")).toHaveClass(/valid/);
  });

  test("experimental imports stay unavailable in the release configuration", async ({ page }) => {
    await page.goto("/settings/imports");
    await expect(page.getByRole("heading", { level: 1, name: "Import inbox" })).toHaveCount(0);
  });

  test("Settings manages custom category groups without leaving the page", async ({ page }) => {
    await page.goto("/settings");
    await page.locator(".category-group-settings > summary").click();
    const groupRowLayout = await page.locator(".category-group-row").first().evaluate((element) => {
      const style = getComputedStyle(element);
      return { display: style.display, alignItems: style.alignItems, minHeight: Number.parseFloat(style.minHeight) };
    });
    expect(groupRowLayout).toEqual({ display: "flex", alignItems: "center", minHeight: 61 });
    await page.getByLabel("New category group").fill("Giving");
    await page.getByRole("button", { name: "Add group" }).click();
    await expect(page.getByText("Giving", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Rename Giving" }).click();
    await page.getByLabel("Category group name").fill("Generosity");
    await page.getByRole("button", { name: "Save Giving" }).click();
    await expect(page.getByText("Generosity", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Delete Generosity" }).click();
    await expect(page.getByText("Generosity", { exact: true })).toBeHidden();
  });

  test("Settings sign out control ends the demo session", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: /Sign out/ }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Welcome home." })).toBeVisible();
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

function demoPublixDetail() {
  return { id: "t1", merchant: "Publix", importedMerchant: "Publix", categoryId: "groceries", category: "Groceries", amountCents: -8642, date: "Today", isoDate: "2026-07-15T12:00:00.000Z", status: "posted", color: "#45D9E1", accountId: "demo-card", accountName: "Rewards card", rawDescription: "PUBLIX #1234", note: "", excluded: false, isTransfer: false, isRecurring: false, reviewStatus: "needs_review", reviewedAt: null, allocations: [{ categoryId: "groceries", category: "Groceries", amountCents: -8642 }], auditHistory: [] };
}
