import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const routes = [
  { path: "/", name: "home", heading: /Good (morning|afternoon|evening)/ },
  { path: "/budget", name: "budget", heading: "Budget" },
  { path: "/activity", name: "activity", heading: "Activity" },
  { path: "/plan", name: "plan", heading: "Plan" },
  { path: "/income", name: "income-redirect", heading: "Plan" },
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
    await groceriesBudget.blur();
    await expect(budgetEditor.getByRole("status")).toContainText("Groceries saved");
    await expect(budgetEditor.getByRole("button", { name: /Add category/ })).toBeVisible();
    await expect(budgetEditor.getByText("Month setup")).toBeVisible();
    await capture(page, testInfo, "budget-editor");
    await swipe(page, budgetEditor.getByRole("button", { name: "Drag down to close monthly budget editor" }), 2, 140);
    await expect(budgetEditor).toBeHidden();
    await page.locator(".budget-group").getByRole("button", { name: /Groceries/ }).click();
    const detail = page.getByRole("dialog", { name: "Groceries category detail" });
    await expect(detail).toBeVisible();
    await expect(detail.getByText("Recent transactions")).toBeVisible();
    await expect(detail.getByText("Publix")).toBeVisible();
    await expect(detail.getByRole("button", { name: "Move money" })).toBeVisible();
    await expect(detail.getByLabel("Category name")).toHaveValue("Groceries");
    await expect(detail.getByRole("button", { name: "Change category icon" })).toBeVisible();
    await expect(detail.getByRole("button", { name: "Essentials" })).toHaveAttribute("aria-pressed", "true");
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, "budget-category-sheet");
    await page.locator(".category-sheet").evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(detail.getByLabel("Groceries monthly budget")).toBeVisible();
    await capture(page, testInfo, "budget-category-sheet-actions");
  });

  test("a new budget month starts empty instead of reusing current transactions", async ({ page }) => {
    await page.goto("/budget");
    await page.getByRole("link", { name: "Aug" }).click();
    await expect(page.getByRole("navigation", { name: "Budget month" })).toContainText("Aug 2026");
    await page.getByRole("button", { name: /Groceries/ }).click();
    await expect(page.getByRole("dialog", { name: "Groceries category detail" }).getByText("No transactions in this month.")).toBeVisible();
  });

  test("category name, icon, and group save directly in the category modal", async ({ page }) => {
    await page.goto("/budget");
    await page.locator(".budget-group").getByRole("button", { name: /Groceries/ }).click();
    const detail = page.getByRole("dialog", { name: "Groceries category detail" });
    await detail.getByRole("button", { name: "Change category icon" }).click();
    await detail.getByRole("button", { name: "Coffee", exact: true }).click();
    await expect(detail.locator(".category-autosave-status")).toContainText("Saved");
    await detail.getByLabel("Category name").fill("Food");
    await detail.getByLabel("Category name").blur();
    const renamedDetail = page.getByRole("dialog", { name: "Food category detail" });
    await expect(renamedDetail.getByLabel("Category name")).toHaveValue("Food");
    await renamedDetail.getByRole("button", { name: "Lifestyle" }).click();
    await expect(renamedDetail.getByRole("button", { name: "Lifestyle" })).toHaveAttribute("aria-pressed", "true");
    await expect(renamedDetail.locator(".category-autosave-status")).toContainText("Saved");
  });

  test("Budget and Plan link to reconciled monthly Income", async ({ page }, testInfo) => {
    await page.goto("/budget");
    await page.getByRole("link", { name: "Income", exact: true }).click();
    await expect(page).toHaveURL(/\/plan\?month=2026-07#income/);
    await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();
    await expect(page.locator("#income").getByText("$3,425.00").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Received" })).toBeVisible();
    await expect(page.getByText("Payroll", { exact: true })).toBeVisible();
    await expect(page.getByText("No unmatched deposits.")).toBeVisible();
    await capture(page, testInfo, "income");
    await expect(page.getByRole("region", { name: "Cash-flow summary" })).toBeVisible();
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
    await expect(detail.getByRole("button", { name: "Review transaction" })).toBeVisible();
    await detail.getByText("More controls").click();
    for (const control of ["Remember", "Recurring", "Transfer", "Exclude"]) await expect(detail.getByRole("button", { name: control, exact: true })).toBeVisible();
    await detail.getByRole("button", { name: "Publix", exact: true }).click();
    await expect(detail.getByLabel("Merchant display name")).toHaveValue("Publix");
    await detail.getByLabel("Merchant display name").fill("");
    await detail.getByLabel("Merchant display name").pressSequentially("Publix Market");
    await expect(detail.getByLabel("Merchant display name")).toBeFocused();
    await detail.locator(".category-select-trigger").click();
    const picker = page.getByRole("dialog", { name: "Choose category for Publix Market" });
    await expect(picker.getByRole("button", { name: /Housing/ })).toBeVisible();
    await expect(picker.getByRole("button", { name: /Groceries/ })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(detail).toBeVisible();
    await expect(detail.getByText("Description")).toBeVisible();
    await expect(detail.getByText("Status", { exact: true })).toHaveCount(0);
    await expect(detail.getByLabel("Household note")).toBeHidden();
    await expect(detail.getByText("Change history")).toBeHidden();
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, "activity-transaction-detail");
    await page.locator(".transaction-sheet").evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(detail.getByRole("button", { name: "Save changes", exact: true })).toBeVisible();
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
    const budgetCategories = page.locator(".budget-page > .budget-group .budget-row");
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
    let detail = page.getByRole("dialog", { name: /Publix transaction details/ });
    await detail.getByRole("button", { name: "Review transaction" }).click();
    await expect(page.getByRole("dialog", { name: /Target transaction details/ })).toBeVisible();
    detail = page.getByRole("dialog", { name: /Target transaction details/ });
    await detail.getByRole("button", { name: "Review transaction" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "All caught up" })).toBeVisible();
  });

  test("Review Undo restores the complete transaction edit", async ({ page }) => {
    let undoRequested = false;
    await page.route("**/api/transactions/**", async (route) => {
      const payload = route.request().postDataJSON() as { undo?: boolean };
      if (payload.undo) {
        undoRequested = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Last transaction edit undone.",
            restored: {
              displayName: null,
              note: "",
              excluded: false,
              isTransfer: false,
              isRecurring: false,
              reviewStatus: "needs_review",
              reviewedAt: null,
              allocations: [{ categoryId: "groceries", amountCents: -8642 }],
            },
          }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "Transaction reviewed.", transaction: { updated_at: "2026-07-16T12:00:00.000Z" } }) });
    });
    await page.goto("/activity");
    await page.getByRole("button", { name: /Publix, Groceries/ }).click();
    const detail = page.getByRole("dialog", { name: /Publix transaction details/ });
    await detail.getByRole("button", { name: "Publix", exact: true }).click();
    await detail.getByLabel("Merchant display name").fill("Publix Market");
    await detail.getByRole("button", { name: "Review transaction" }).click();
    await expect(page.getByRole("dialog", { name: /Target transaction details/ })).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => undoRequested).toBe(true);
    await expect(page.getByRole("status")).toContainText("Last transaction edit undone");
    await page.getByRole("dialog", { name: /Target transaction details/ }).getByRole("button", { name: "Close transaction", exact: true }).click();
    await page.getByRole("button", { name: /Publix, Groceries/ }).click();
    await expect(page.getByRole("dialog", { name: /Publix transaction details/ }).getByRole("button", { name: "Review transaction" })).toBeEnabled();
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

  test("transaction detail floats as a dismissible modal", async ({ page }) => {
    await page.goto("/activity");
    await page.getByRole("button", { name: /Publix, Groceries/ }).click();
    const detail = page.getByRole("dialog", { name: /Publix transaction details/ });
    await page.locator(".transaction-sheet").evaluate((element) => { element.scrollTop = 180; });
    await expect(detail).toBeVisible();
    const box = await page.locator(".transaction-sheet").boundingBox();
    expect(box?.height ?? 9999).toBeLessThan(844);
    expect(box?.y ?? 0).toBeGreaterThan(0);
    await detail.getByRole("button", { name: "Close transaction", exact: true }).click();
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
    await detail.getByLabel("Split 1 amount").fill("");
    await detail.getByLabel("Split 1 amount").pressSequentially("20");
    await expect(detail.getByLabel("Split 1 amount")).toBeFocused();
    await expect(detail.getByLabel("Split 2 amount")).toHaveValue("54.21");
    await expect(detail.locator(".split-total")).toHaveClass(/valid/);
  });

  test("Review keeps an invalid split open without sending it", async ({ page }) => {
    let updateRequests = 0;
    await page.route("**/api/transactions/**", async (route) => {
      updateRequests += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "Transaction reviewed." }) });
    });
    await page.goto("/activity");
    await page.getByRole("button", { name: /Target, Unsorted/ }).click();
    const detail = page.getByRole("dialog", { name: /Target transaction details/ });
    await detail.getByRole("button", { name: "Split transaction" }).click();
    await detail.getByLabel("Split 1 amount").fill("");
    await detail.getByRole("button", { name: "Review transaction" }).click();
    await expect(detail).toBeVisible();
    await expect(detail.getByRole("status")).toContainText("Each split needs a category and positive amount");
    expect(updateRequests).toBe(0);
  });

  test("Review stays open when the transaction save fails", async ({ page }) => {
    await page.route("**/api/transactions/**", async (route) => route.abort("failed"));
    await page.goto("/activity");
    await page.getByRole("button", { name: /Publix, Groceries/ }).click();
    const detail = page.getByRole("dialog", { name: /Publix transaction details/ });
    await detail.getByRole("button", { name: "Review transaction" }).click();
    await expect(detail).toBeVisible();
    await expect(detail.getByRole("status")).toContainText("Check your connection");
  });

  test("nested transaction sheets retain the iPhone scroll lock", async ({ page }) => {
    await page.goto("/activity");
    await page.getByRole("button", { name: "All activity" }).click();
    await expect(page.getByRole("button", { name: /Publix,/ }).first()).toBeVisible();
    await page.evaluate(() => { document.body.style.minHeight = "1600px"; window.scrollTo(0, 120); });
    expect(await page.evaluate(() => window.scrollY)).toBe(120);
    const clicked = await page.evaluate(() => {
      const row = [...document.querySelectorAll<HTMLElement>('[role="button"][aria-label]')].find((element) => element.getAttribute("aria-label")?.startsWith("Publix,"));
      row?.click();
      return Boolean(row);
    });
    expect(clicked).toBe(true);
    const detail = page.getByRole("dialog", { name: /Publix transaction details/ });
    await expect(page.locator("body")).toHaveCSS("position", "fixed");
    expect(await page.locator("body").evaluate((body) => body.style.top)).toBe("-120px");
    await detail.locator(".category-select-trigger").click();
    await page.getByRole("button", { name: "Close category picker" }).click();
    await expect(page.locator("body")).toHaveCSS("position", "fixed");
    await detail.getByRole("button", { name: "Close transaction", exact: true }).click();
    await expect(page.locator("body")).not.toHaveCSS("position", "fixed");
    expect(await page.evaluate(() => window.scrollY)).toBe(120);
  });

  test("recurring control opens required schedule setup", async ({ page }) => {
    await page.goto("/activity");
    await page.getByRole("button", { name: /Publix, Groceries/ }).click();
    const detail = page.getByRole("dialog", { name: /Publix transaction details/ });
    await detail.getByText("More controls").click();
    await detail.getByRole("button", { name: "Recurring", exact: true }).click();
    const setup = page.getByRole("dialog", { name: "Set up recurring Publix" });
    await expect(setup.getByLabel("Expected amount")).toHaveValue("86.42");
    await expect(setup.getByLabel("Cadence")).toHaveValue("monthly");
    await expect(setup.getByLabel("Next date")).not.toHaveValue("");
  });

  test("experimental imports stay unavailable in the release configuration", async ({ page }) => {
    await page.goto("/settings/imports");
    await expect(page.getByRole("heading", { level: 1, name: "Import inbox" })).toHaveCount(0);
  });

  test("Budget editor manages custom category groups without leaving the budget", async ({ page }) => {
    await page.goto("/budget");
    await page.getByRole("button", { name: "Edit budget" }).click();
    const editor = page.getByRole("dialog", { name: "Edit July budget" });
    await editor.locator(".category-group-settings > summary").click();
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
