import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";

async function request(page: Page, path: string, method = "GET", data?: unknown) {
  return page.evaluate(
    async ({ path, method, data }) => {
      const response = await fetch(path, {
        method,
        ...(data === undefined
          ? {}
          : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
      });
      return { status: response.status, body: await response.json() };
    },
    { path, method, data },
  );
}
test.beforeEach(async ({ page }) => {
  const accounts = JSON.parse(readFileSync(".e2e/account.json", "utf8"));
  const account = accounts.find(
    (item: { mustChangePassword: boolean }) => !item.mustChangePassword,
  );
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole("button", { name: "Sign in to my workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator("main h1")).toBeVisible();
});

test("Vault: upload, private preview, edit, download and delete", async ({ page, browser }) => {
  await page.goto("/document-vault");
  await page.getByLabel("Category", { exact: true }).fill("Cloud / DevOps");
  await page.getByLabel("Subjects (comma separated)").fill("Kubernetes, Security");
  await page.getByLabel("Choose files").setInputFiles({
    name: "feature-evidence.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Private Kubernetes lab evidence\nA completed namespace exercise."),
  });
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "feature-evidence.txt", exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByRole("dialog").locator("pre")).toContainText(
    "Private Kubernetes lab evidence",
  );
  const files = (await request(page, "/api/files")).body.data.files;
  const file = files.find(
    (item: { originalName: string }) => item.originalName === "feature-evidence.txt",
  );
  const content = await page.request.get(`/api/files/${file.id}/content`);
  expect(content.headers()["x-content-type-options"]).toBe("nosniff");
  expect(content.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  const anonymous = await browser.newContext();
  expect(
    (
      await anonymous.request.get(new URL(`/api/files/${file.id}/content`, page.url()).href)
    ).status(),
  ).toBe(401);
  await anonymous.close();
  await page.getByRole("dialog").getByRole("button", { name: "Close dialog", exact: true }).click();
  await card.getByRole("button", { name: "Edit file feature-evidence.txt" }).click();
  await page.getByLabel("File title").fill("Reviewed lab evidence");
  await page.getByLabel("Description", { exact: true }).fill("Reviewed certificate evidence");
  await page.getByRole("button", { name: "Save file details" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByLabel("Search vault").fill("Reviewed lab");
  await expect(page.getByRole("heading", { name: "Reviewed lab evidence" })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download Reviewed lab evidence" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("feature-evidence.txt");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete file Reviewed lab evidence" }).click();
  await expect(page.getByRole("heading", { name: "Reviewed lab evidence" })).toHaveCount(0);
});

test("AI: encrypted key settings, context selection, persistent chat management", async ({
  page,
}) => {
  await page.goto("/ai-assistant");
  await expect(page.getByText("to start chatting.")).toBeVisible();
  await page.getByRole("button", { name: "AI Settings", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("DeepSeek API key").fill("sk-e2e-placeholder-not-a-provider-key");
  await dialog.getByRole("button", { name: "Save AI settings" }).click();
  await expect(dialog.getByText("API key connected")).toBeVisible();
  expect(JSON.stringify((await request(page, "/api/ai/settings")).body)).not.toContain("sk-e2e");
  page.once("dialog", (alert) => alert.accept());
  await dialog.getByRole("button", { name: "Remove key" }).click();
  await expect(dialog.getByText("API key needed")).toBeVisible();
  await dialog.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await expect(page.locator(".chat-history button")).toHaveCount(1);
  await page.getByText("Context & attachments", { exact: false }).click();
  await page.getByLabel("Context to share").selectOption("selected_files");
  await expect(page.getByLabel("Search vault files")).toBeVisible();
  await page.getByLabel("Message AI assistant").fill("Please review my selected notes.");
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.locator(".chat-history button")).toHaveCount(1);
  page.once("dialog", (alert) => alert.accept());
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  page.once("dialog", (alert) => alert.accept());
  await page.getByRole("button", { name: "Delete conversation" }).click();
  await expect(page.locator(".chat-history button")).toHaveCount(0);
});

test("Progress, monthly review and automation persist real changes", async ({ page }) => {
  const created = await request(page, "/api/entries", "POST", {
    kind: "project",
    title: "Feature QA project",
    category: "Cloud / DevOps",
    details: { stack: "Next.js, Kubernetes", problem: "Track deployment evidence" },
  });
  expect(created.status).toBe(201);
  await page.goto("/progress");
  await page.getByLabel("Stage for Feature QA project").selectOption("Testing");
  await expect(page.getByLabel("Progress percentage for Feature QA project")).toHaveValue("74");
  await page.reload();
  await expect(page.getByLabel("Stage for Feature QA project")).toHaveValue("Testing");
  await page.getByLabel("Progress percentage for Feature QA project").fill("100");
  await page.getByLabel("Search progress").click();
  await expect(page.getByLabel("Stage for Feature QA project")).toHaveValue("Completed");
  await page.goto("/monthly-review");
  await page.getByLabel("Review month").fill("2026-09");
  await page.getByLabel("Month score / 10").fill("8");
  await page.getByLabel("What did I complete?", { exact: true }).fill("Finished deployment lab");
  await page.getByLabel("Which skills improved?").fill("Kubernetes troubleshooting");
  await page.getByRole("button", { name: "Save monthly review" }).click();
  await expect(page.getByRole("status")).toContainText("Monthly review saved");
  await page.reload();
  await expect(page.getByText("Finished deployment lab", { exact: true })).toBeVisible();
  await page.goto("/automation");
  await page.getByRole("button", { name: "Test notification" }).click();
  await expect(page.getByRole("button", { name: "Mark read", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByRole("button", { name: "Mark read", exact: true })).toHaveCount(0);
  await page.getByLabel("Morning reminder").fill("08:15");
  await page.getByRole("button", { name: "Save schedule" }).click();
  await expect(page.getByRole("status")).toContainText("Automation settings saved");
  await page.reload();
  await expect(page.getByLabel("Morning reminder")).toHaveValue("08:15");
  expect((await request(page, "/api/automation")).body.data.jobs).toHaveLength(7);
});

test("Backup preview and restore preserve existing records; preferences survive reload", async ({
  page,
}) => {
  const backup = (await request(page, "/api/backup")).body;
  await page.goto("/backup");
  await page.getByLabel("Or paste backup JSON").fill(JSON.stringify(backup));
  await page.getByRole("button", { name: "Preview restore" }).click();
  await expect(page.locator("pre")).toContainText('"dryRun": true');
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Restore missing records" }).click();
  await expect(page.locator("pre")).toContainText('"dryRun": false');
  await page.goto("/settings");
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Language", { exact: true }).selectOption("bn");
  await expect(page.locator("main h1")).toHaveText("সেটিংস");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("Language", { exact: true })).toHaveValue("bn");
  await page.getByLabel("Language", { exact: true }).selectOption("en");
  await expect(page.locator("main h1")).toHaveText("Settings");
  await page.getByLabel("Theme", { exact: true }).selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("Original feature routes and floating assistant work at desktop and mobile sizes", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const routes = [
    "ai-assistant",
    "document-vault",
    "roadmaps",
    "progress",
    "monthly-review",
    "automation",
    "backup",
    "academic",
    "ielts-sat",
    "cloud-devops",
    "ai-automation",
    "portfolio-projects",
    "debate",
    "rover-scout",
    "olympiad-contest",
    "personal-skills",
    "country-strategy",
    "weekly-routine",
    "final-identity",
    "remove-from-life",
    "certificates",
    "final-target-document",
  ];
  mkdirSync("artifacts", { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      const response = await page.goto(`/${route}`);
      expect(response?.status(), route).toBe(200);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${route} horizontal overflow at ${width}`,
      ).toBe(true);
      if (["ai-assistant", "roadmaps", "progress"].includes(route))
        await page.screenshot({
          path: `artifacts/features-${route}-${width}.png`,
          fullPage: false,
        });
    }
    await page.getByRole("button", { name: "Open AI assistant", exact: true }).click();
    await expect(page.getByLabel("Message AI assistant")).toBeVisible();
    await page.getByRole("button", { name: "Close AI assistant" }).click();
  }
  expect(errors).toEqual([]);
  // App Router notFound() can return HTTP 200 once a streamed response has started.
  // Verify the semantic 404 result instead of relying on the transport status code.
  await page.goto("/exam-mode");
  await expect(page.getByText("404 · Page not found", { exact: true })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
