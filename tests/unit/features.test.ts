import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../src/lib/db", () => ({ db: {} }));
beforeEach(() =>
  vi.stubEnv("AI_ENCRYPTION_KEY", "isolated-unit-encryption-fixture-at-least-48-characters"),
);
afterEach(() => vi.unstubAllEnvs());
import { encryptSecret, decryptSecret } from "../../src/lib/secrets";
import { detectedMime } from "../../src/lib/vault";
import { chatRequestSchema, automationSettingsSchema } from "../../src/lib/feature-validation";
import { dueAutomationJobs } from "../../src/lib/automation";
import { parseAiReply } from "../../src/lib/ai";

describe("feature security boundaries", () => {
  it("encrypts API keys with owner binding and rejects tampered ciphertext", () => {
    const value = encryptSecret("test-provider-key-not-a-real-secret", "owner-a");
    expect(value).not.toContain("test-provider-key");
    expect(decryptSecret(value, "owner-a")).toBe("test-provider-key-not-a-real-secret");
    expect(() => decryptSecret(value, "owner-b")).toThrow();
    const parts = value.split(".");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decryptSecret(parts.join("."), "owner-a")).toThrow();
  });
  it("does not trust uploaded MIME labels or execute HTML previews", () => {
    expect(detectedMime(Buffer.from("<script>alert(1)</script>"), "page.html")).toBe("text/plain");
    expect(detectedMime(Buffer.from("not a real image"), "image.png")).toBe(
      "application/octet-stream",
    );
    expect(detectedMime(Buffer.from("%PDF-1.7\n"), "report.pdf")).toBe("application/pdf");
  });
  it("requires explicit attachment context and a selected category for field context", () => {
    expect(() =>
      chatRequestSchema.parse({
        threadId: "x",
        message: "Hi",
        contextMode: "general",
        attachments: [{ name: "private.txt", text: "private", sizeBytes: 7 }],
      }),
    ).toThrow();
    expect(() =>
      chatRequestSchema.parse({ threadId: "x", message: "Hi", contextMode: "current_field" }),
    ).toThrow();
    expect(chatRequestSchema.parse({ threadId: "x", message: "Hi" }).contextMode).toBe("general");
  });
  it("validates generated actions and refuses destructive or malformed responses", () => {
    expect(parseAiReply('```json\n{"reply":"Hello","actions":[]}\n```').reply).toBe("Hello");
    expect(() =>
      parseAiReply('{"reply":"Hello","actions":[{"type":"delete_file","fileId":"x"}]}'),
    ).toThrow();
    expect(() => parseAiReply('{"reply":')).toThrow();
  });
  it("calculates owner-timezone schedule slots and never resurrects the ended exam", () => {
    const cfg = automationSettingsSchema.parse({
      enabled: true,
      enabledJobs: ["daily_study_reminder", "weekly_review", "devops_health"],
    });
    const friday = new Date("2026-09-11T15:01:00Z");
    expect(dueAutomationJobs(cfg, "Asia/Dhaka", friday)).toEqual([
      { jobId: "daily_study_reminder", slot: "2026-09-11" },
      { jobId: "weekly_review", slot: "2026-09-11" },
      { jobId: "devops_health", slot: "2026-09-11/42" },
    ]);
    expect(dueAutomationJobs({ ...cfg, enabled: false }, "Asia/Dhaka", friday)).toEqual([]);
    expect(() => automationSettingsSchema.parse({ enabledJobs: ["exam_countdown"] })).toThrow();
  });
});
