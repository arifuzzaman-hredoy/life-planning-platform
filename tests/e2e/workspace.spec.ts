import { expect, test as base, type Page, type Locator } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { Workspace } from "../../src/lib/contracts";

type TestAccount = { id: string; email: string; password: string; mustChangePassword: boolean };
function account(initial = false) {
  const accounts = JSON.parse(readFileSync(".e2e/account.json", "utf8")) as TestAccount[];
  return accounts.find((item) => item.mustChangePassword === initial)!;
}
const test = base.extend({
  page: async ({ page }, providePage) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 400)
        errors.push(
          `${response.request().method()} ${new URL(response.url()).pathname}: HTTP ${response.status()}`,
        );
    });
    await providePage(page);
    expect(errors, "Browser console and unhandled JavaScript errors").toEqual([]);
  },
});
const unique = (label: string) => `${label} ${randomUUID().slice(0, 6)}`;
async function signIn(page: Page, initial = false) {
  const fixture = account(initial);
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(fixture.email);
  await page.locator('input[name="password"]').fill(fixture.password);
  await page.getByRole("button", { name: "Sign in to my workspace" }).click();
  await expect(page).toHaveURL(initial ? /\/settings$/ : /\/dashboard$/);
  await expect(page.locator("main h1")).toBeVisible();
}
async function workspace(page: Page): Promise<Workspace> {
  const response = await page.evaluate(async () => {
    const result = await fetch("/api/workspace");
    return { status: result.status, body: await result.json() };
  });
  expect(response.status).toBe(200);
  return (response.body as { data: Workspace }).data;
}
async function newEntry(page: Page, route: string, button: string, title: string) {
  await page.goto(route);
  await page.getByRole("button", { name: button, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: true }).fill(title);
  return dialog;
}
async function saveEntry(page: Page, dialog: Locator, edit = false) {
  await dialog
    .getByRole("button", { name: edit ? "Save changes" : "Create item", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.form-error[role="alert"]')).toHaveCount(0);
}
function card(page: Page, title: string) {
  return page
    .locator("article.entry-card")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}
async function editEntry(page: Page, title: string) {
  await page.getByRole("button", { name: `Edit ${title}`, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test.beforeEach(async ({ page }, info) => {
  if (!info.title.startsWith("Initial password")) await signIn(page);
});

test("Goals: create, edit, link a milestone, complete and persist", async ({ page }) => {
  const title = unique("Cloud security goal");
  const renamed = `${title} reviewed`;
  let dialog = await newEntry(page, "/goals", "New goal", title);
  await dialog.getByLabel("Planning period").selectOption("yearly");
  await dialog.getByLabel("Target date", { exact: true }).fill("2027-12-31");
  await dialog.getByLabel("Progress (%)").fill("35");
  await dialog.getByLabel("Notes", { exact: true }).fill("Complete practical cloud-security labs.");
  await saveEntry(page, dialog);
  await expect(card(page, title).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "35");
  dialog = await editEntry(page, title);
  await dialog.getByLabel("Title", { exact: true }).fill(renamed);
  await saveEntry(page, dialog, true);
  await card(page, renamed).getByRole("button", { name: "Add milestone" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: true }).fill(`${renamed} milestone`);
  await saveEntry(page, dialog);
  await expect(
    card(page, renamed).getByRole("button", { name: `Complete ${renamed} milestone` }),
  ).toBeVisible();
  await page.reload();
  dialog = await editEntry(page, renamed);
  await expect(dialog.getByLabel("Planning period")).toHaveValue("yearly");
  await dialog.getByLabel("Status", { exact: true }).selectOption("done");
  await saveEntry(page, dialog, true);
  await page.getByLabel("Filter by status").selectOption("done");
  await expect(card(page, renamed).getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  const data = await workspace(page);
  const goal = data.entries.find((item) => item.title === renamed)!;
  expect(data.entries.find((item) => item.title === `${renamed} milestone`)).toMatchObject({
    parentId: goal.id,
    goalId: goal.id,
  });
});

test("Projects and tasks: linked subtasks, recurring completion and search", async ({ page }) => {
  const projectTitle = unique("Infrastructure portfolio");
  let dialog = await newEntry(page, "/projects", "New project", projectTitle);
  await dialog.getByLabel("Repository URL").fill("https://github.com/kubernetes/examples");
  await saveEntry(page, dialog);
  await card(page, projectTitle).getByRole("button", { name: "Add task or milestone" }).click();
  dialog = page.getByRole("dialog");
  const taskTitle = unique("Practice deployment");
  await dialog.getByLabel("Title", { exact: true }).fill(taskTitle);
  await dialog.getByLabel("Target date", { exact: true }).fill("2026-12-31");
  await dialog.getByLabel("Repeat after completion").selectOption("weekly");
  await saveEntry(page, dialog);
  await page.goto("/tasks");
  await page.getByLabel("Search tasks").fill(taskTitle);
  await page.getByRole("button", { name: `Complete ${taskTitle}`, exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Completed. A step forward!");
  const data = await workspace(page);
  const matching = data.entries.filter((item) => item.title === taskTitle);
  expect(matching).toHaveLength(2);
  expect(matching.find((item) => item.status === "planned")?.targetDate).toBe("2027-01-07");
  const project = data.entries.find((item) => item.title === projectTitle)!;
  expect(
    matching.every((item) => item.parentId === project.id && item.projectId === project.id),
  ).toBe(true);
  await page.reload();
  await page.getByLabel("Search tasks").fill(taskTitle);
  await page.getByLabel("Filter by status").selectOption("done");
  await expect(
    page.getByRole("button", { name: `Reopen ${taskTitle}`, exact: true }),
  ).toBeVisible();
});

test("Habits: target counts, history, decrement and reload", async ({ page }) => {
  const title = unique("Read two chapters");
  const dialog = await newEntry(page, "/habits", "New habit", title);
  await dialog.getByLabel("Target per period").fill("2");
  await saveEntry(page, dialog);
  const habit = page
    .locator("article.habit-card")
    .filter({ has: page.getByRole("heading", { name: title }) });
  const increase = habit.getByRole("button", { name: `Increase ${title} count` });
  await increase.click();
  await expect(habit.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  await increase.click();
  await expect(habit.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  await page.reload();
  await expect(habit.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  await habit.getByRole("button", { name: `Decrease ${title} count` }).click();
  await expect(habit.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  await expect(habit.locator(".history-day.recorded")).toHaveCount(1);
});

test("Learning: resources, progress, study log and session deletion", async ({ page }) => {
  const title = unique("Kubernetes fundamentals");
  const dialog = await newEntry(page, "/learning", "New learning item", title);
  await dialog.getByLabel("Resource type").selectOption("technology");
  await dialog.getByLabel("Topic / technology").fill("Kubernetes");
  await dialog.getByLabel("Additional resource links").fill("https://kubernetes.io/docs/");
  await dialog.getByLabel("Progress (%)").fill("20");
  await saveEntry(page, dialog);
  await card(page, title).getByRole("button", { name: "Log study" }).click();
  const study = page.getByRole("dialog");
  await study.getByLabel("Minutes studied").fill("45");
  await study
    .getByLabel("What did you practice?")
    .fill("Applied a deployment and verified rollout.");
  await study.getByRole("button", { name: "Log session" }).click();
  await expect(study.getByText("45 minutes", { exact: true })).toBeVisible();
  await study.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await expect(card(page, title).getByText("0.8h studied · 1 sessions")).toBeVisible();
  await expect(card(page, title).getByRole("link", { name: "kubernetes.io" })).toHaveAttribute(
    "href",
    "https://kubernetes.io/docs/",
  );
  await card(page, title).getByRole("button", { name: "Log study" }).click();
  await study.getByRole("button", { name: /Delete study session/ }).click();
  await study.getByRole("button", { name: "Confirm delete" }).click();
  await expect(study.getByText("45 minutes", { exact: true })).toHaveCount(0);
});

test("Career: company, interview stage, skill gaps and saved changes", async ({ page }) => {
  const title = unique("Cloud engineering opportunity");
  let dialog = await newEntry(page, "/career", "New career item", title);
  await dialog.getByLabel("Company / organization").fill("Example Engineering");
  await dialog.getByLabel("Role / objective").fill("Cloud Engineer");
  await dialog.getByLabel("Career activity").selectOption("interview");
  await dialog.getByLabel("Skills to develop").fill("Terraform, Networking");
  await saveEntry(page, dialog);
  await expect(card(page, title).getByText("Cloud Engineer at Example Engineering")).toBeVisible();
  await page.reload();
  dialog = await editEntry(page, title);
  await expect(dialog.getByLabel("Career activity")).toHaveValue("interview");
  await dialog.getByLabel("Progress (%)").fill("50");
  await saveEntry(page, dialog, true);
  await expect(card(page, title).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
});

test("Notes: text safety, pin, global search, archive and restore", async ({ page }) => {
  const title = unique("Deployment notes");
  const dialog = await newEntry(page, "/notes", "New note", title);
  await dialog
    .getByLabel("Note content")
    .fill("<script>window.__unsafeNote = true</script>\nUseful checklist: test, deploy, verify.");
  await saveEntry(page, dialog);
  expect(await page.evaluate(() => Object.hasOwn(window, "__unsafeNote"))).toBe(false);
  await card(page, title)
    .getByRole("button", { name: `Pin ${title}`, exact: true })
    .click();
  await expect(card(page, title).getByRole("button", { name: `Unpin ${title}` })).toBeVisible();
  await page.getByRole("button", { name: "Search anything" }).click();
  await page.getByLabel("Search titles, notes, categories and tags").fill(title);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: new RegExp(title) })
    .click();
  await expect(page.getByRole("dialog").getByLabel("Title", { exact: true })).toHaveValue(title);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await card(page, title).getByRole("button", { name: "Archive note" }).click();
  await page.getByLabel("Filter by status").selectOption("archived");
  await card(page, title).getByRole("button", { name: "Restore note" }).click();
  await page.getByLabel("Filter by status").selectOption("open");
  await expect(card(page, title)).toBeVisible();
});

test("Journal and important dates: detailed reflection and future appointment", async ({
  page,
}) => {
  const title = unique("Weekly review");
  let dialog = await newEntry(page, "/journal", "New journal entry", title);
  await dialog.getByLabel("Planning period").selectOption("weekly");
  await dialog.getByLabel("What went well?").fill("Finished a hands-on deployment.");
  await dialog.getByLabel("What was difficult?").fill("Understanding the network policy.");
  await dialog.getByLabel("What did you learn?").fill("Test connectivity before changing rules.");
  await dialog.getByLabel("What will you do next?").fill("Write an operational checklist.");
  await saveEntry(page, dialog);
  await page.reload();
  await expect(
    card(page, title).getByText("Test connectivity before changing rules."),
  ).toBeVisible();
  const appointment = unique("Certification exam");
  dialog = await newEntry(page, "/timeline", "New important date", appointment);
  await dialog.getByLabel("Event date").fill("2027-03-15");
  await dialog.getByLabel("Event type").selectOption("exam");
  await dialog.getByLabel("Time (your timezone)").fill("10:30");
  await saveEntry(page, dialog);
  await page.reload();
  await expect(card(page, appointment).getByText("10:30", { exact: true })).toBeVisible();
});

test("Daily planner: priorities, schedule and reflections survive reload", async ({ page }) => {
  await page.goto("/planner");
  await page.getByLabel("Priority 1", { exact: true }).fill("Finish the network lab");
  await page.getByLabel("Priority 2", { exact: true }).fill("Take a walk");
  await page.getByLabel("Daily schedule").fill("09:00 Focus time\n14:00 Study session");
  await page.getByLabel("Daily notes").fill("Keep the plan realistic.");
  await page.getByLabel("Daily reflection").fill("Small steps made the work manageable.");
  await page.getByRole("button", { name: "Save daily plan" }).click();
  await expect(page.getByText("All changes saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Priority 1", { exact: true })).toHaveValue(
    "Finish the network lab",
  );
  await expect(page.getByLabel("Daily schedule")).toHaveValue(
    "09:00 Focus time\n14:00 Study session",
  );
  await expect(page.getByLabel("Daily reflection")).toHaveValue(
    "Small steps made the work manageable.",
  );
});

test("Finance: income and expense, budget, savings and retained balances", async ({ page }) => {
  await page.goto("/finance");
  const title = unique("Learning book");
  await page.getByRole("button", { name: "New transaction", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: true }).fill(title);
  await dialog.getByLabel("Category", { exact: true }).fill("Learning");
  await dialog.getByLabel("Amount", { exact: true }).fill("499.50");
  await dialog.getByLabel("Notes", { exact: true }).fill("Reference book");
  await dialog.getByRole("button", { name: "Save transaction" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: new RegExp(title) }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: true }).fill(`${title} revised`);
  await dialog.getByRole("button", { name: "Save transaction" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "New transaction", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: true }).fill(unique("Monthly income"));
  await dialog.getByLabel("Type", { exact: true }).selectOption("income");
  await dialog.getByLabel("Category", { exact: true }).fill("Salary");
  await dialog.getByLabel("Amount", { exact: true }).fill("50000");
  await dialog.getByRole("button", { name: "Save transaction" }).click();
  await expect(dialog).not.toBeVisible();
  const budgets = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Category budgets", exact: true }) });
  await budgets.getByRole("button", { name: "Add", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Category", { exact: true }).fill("Learning");
  await dialog.getByLabel("Monthly limit").fill("2000");
  await dialog.getByRole("button", { name: "Save budget" }).click();
  await expect(dialog).not.toBeVisible();
  await budgets.getByRole("button", { name: /Learning/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Monthly limit").fill("2500");
  await dialog.getByRole("button", { name: "Save budget" }).click();
  await expect(dialog).not.toBeVisible();
  const savings = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Saving for something", exact: true }) });
  await savings.getByRole("button", { name: "Add", exact: true }).click();
  dialog = page.getByRole("dialog");
  const savingTitle = unique("Emergency fund");
  await dialog.getByLabel("Title", { exact: true }).fill(savingTitle);
  await dialog.getByLabel("Target amount").fill("100000");
  await dialog.getByLabel("Saved so far").fill("20000");
  await dialog.getByRole("button", { name: "Save savings goal" }).click();
  await expect(dialog).not.toBeVisible();
  await savings.getByRole("button", { name: new RegExp(savingTitle) }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: true }).fill(`${savingTitle} updated`);
  await dialog.getByRole("button", { name: "Save savings goal" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  const data = await workspace(page);
  expect(data.transactions.find((item) => item.title === `${title} revised`)).toMatchObject({
    amount: 499.5,
    currency: "BDT",
    notes: "Reference book",
  });
  expect(data.budgets.find((item) => item.category === "Learning")?.amount).toBe(2500);
  expect(data.savings.find((item) => item.title === `${savingTitle} updated`)).toMatchObject({
    targetAmount: 100000,
    savedAmount: 20000,
  });
});

test("Settings and export: preferences persist and private data downloads", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Your name", { exact: true }).fill("QA planning workspace");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Your preferences are saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("QA planning workspace");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export my workspace" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^life-planning-\d{4}-\d{2}-\d{2}\.json$/);
  const exported = JSON.parse(readFileSync((await download.path())!, "utf8")) as Workspace;
  expect(exported.user.id).toBe(account().id);
  expect(exported.user).not.toHaveProperty("passwordHash");
});

test("Deletion requires confirmation and safely removes the chosen entry", async ({ page }) => {
  const title = unique("Disposable note");
  let dialog = await newEntry(page, "/notes", "New note", title);
  await saveEntry(page, dialog);
  dialog = await editEntry(page, title);
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Delete permanently" })).toBeVisible();
  await dialog.getByRole("button", { name: "Keep item" }).click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(card(page, title)).toBeVisible();
  dialog = await editEntry(page, title);
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete permanently" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(card(page, title)).toHaveCount(0);
  expect((await workspace(page)).entries.some((item) => item.title === title)).toBe(false);
});

test("Initial password: required change, mismatch validation and new login", async ({ page }) => {
  await signIn(page, true);
  const temporary = account(true);
  const newPassword = `Updated QA password ${randomUUID()}!`;
  await expect(page.getByText("Make this workspace yours.", { exact: true })).toBeVisible();
  await page.getByLabel("Current password", { exact: true }).fill(temporary.password);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("Different confirmed password 42!");
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await expect(page.locator('.form-error[role="alert"]')).toHaveText(
    "The new passwords do not match.",
  );
  await page.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await expect(page.getByText("Password changed. Your workspace is ready.")).toBeVisible();
  await expect(page.getByText("Make this workspace yours.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email address", { exact: true }).fill(temporary.email);
  await page.locator('input[name="password"]').fill(newPassword);
  await page.getByRole("button", { name: "Sign in to my workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("Sign out revokes access and cross-origin writes are denied", async ({ page }) => {
  const crossOrigin = await page.request.post("/api/entries", {
    headers: { origin: "https://foreign.example", "content-type": "application/json" },
    data: { kind: "task", title: "Forbidden request" },
  });
  expect(crossOrigin.status()).toBe(403);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/goals");
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
});

test("Desktop, tablet and mobile: every navigation route fits and renders", async ({ page }) => {
  test.setTimeout(180000);
  mkdirSync("artifacts/e2e", { recursive: true });
  const routes = [
    "dashboard",
    "planner",
    "tasks",
    "habits",
    "goals",
    "learning",
    "career",
    "projects",
    "finance",
    "notes",
    "timeline",
    "journal",
    "analytics",
    "settings",
  ];
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["tablet", 820, 1180],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const route of routes) {
      const menu = page.getByRole("button", { name: "Open navigation", exact: true });
      if (await menu.isVisible()) await menu.click();
      await page.locator(`nav a[href="/${route}"]`).click();
      await expect(page).toHaveURL(new RegExp(`/${route}$`));
      await expect(page.locator("main h1")).toBeVisible();
      if (width < 760) {
        await expect
          .poll(async () =>
            page
              .locator("aside.sidebar")
              .evaluate((element) => element.getBoundingClientRect().right),
          )
          .toBeLessThanOrEqual(0);
      }
      const dimensions = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      expect(dimensions.content, `${name} ${route} horizontal overflow`).toBeLessThanOrEqual(
        dimensions.viewport + 1,
      );
      if (["dashboard", "finance", "analytics", "habits"].includes(route))
        await page.screenshot({
          path: `artifacts/e2e/${name}-${route}.png`,
          fullPage: true,
          animations: "disabled",
        });
    }
  }
});
