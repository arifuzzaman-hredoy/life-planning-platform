import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { uploadFile } from "../../src/lib/vault";
import { encryptSecret } from "../../src/lib/secrets";
import { buildAiContext, executeChatAction, sendChat } from "../../src/lib/ai";
import { chatRequestSchema } from "../../src/lib/feature-validation";
import { exportWorkspace, backupSchema, restoreWorkspace } from "../../src/lib/backup";
import { runAutomation } from "../../src/lib/automation";

describe.runIf(process.env.RUN_DB_TESTS === "true")("reference feature persistence", () => {
  const owner = randomUUID(),
    other = randomUUID(),
    restoreOwner = randomUUID();
  let fileId: string, foreignFile: string, threadId: string;
  beforeAll(async () => {
    await db.user.createMany({
      data: [owner, other, restoreOwner].map((id) => ({
        id,
        email: `feature-${id}@example.invalid`,
        name: "Feature QA",
        passwordHash: "unused-fixture",
        mustChangePassword: false,
      })),
    });
    await db.entry.createMany({
      data: [
        {
          userId: owner,
          kind: "goal",
          title: "Owner cloud",
          category: "Cloud",
          notes: "owner-cloud-detail",
        },
        {
          userId: owner,
          kind: "goal",
          title: "Owner other field",
          category: "Other",
          notes: "other-field-detail",
        },
        {
          userId: other,
          kind: "goal",
          title: "Foreign secret",
          category: "Cloud",
          notes: "foreign-secret",
        },
      ],
    });
    fileId = (
      await uploadFile(
        owner,
        new File(["private owner text"], "notes.txt", { type: "text/plain" }),
        { title: "Owner file", category: "Cloud" },
      )
    ).id;
    foreignFile = (
      await uploadFile(other, new File(["foreign secret"], "other.txt"), {
        title: "Foreign file",
        category: "Cloud",
      })
    ).id;
    threadId = (await db.chatThread.create({ data: { userId: owner } })).id;
    await db.aiSettings.create({
      data: {
        userId: owner,
        keyCipher: encryptSecret("fixture-api-key-never-call-live", owner),
        model: "deepseek-v4-flash",
      },
    });
  });
  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: [owner, other, restoreOwner] } } });
    await db.$disconnect();
  });
  const input = (values: Record<string, unknown> = {}) =>
    chatRequestSchema.parse({ threadId, message: "Help me plan", ...values });
  it("persists private uploads and provides scoped AI context without cross-owner access", async () => {
    const saved = await db.vaultFile.findUniqueOrThrow({ where: { id: fileId } });
    expect(Buffer.from(saved.content).toString()).toBe("private owner text");
    expect(await buildAiContext(owner, input())).toEqual({});
    const scoped = JSON.stringify(
      await buildAiContext(owner, input({ contextMode: "current_field", category: "Cloud" })),
    );
    expect(scoped).toContain("owner-cloud-detail");
    expect(scoped).not.toContain("other-field-detail");
    expect(scoped).not.toContain("foreign-secret");
    const selected = await buildAiContext(
      owner,
      input({ contextMode: "selected_files", selectedFileIds: [fileId] }),
    );
    expect(selected.entries).toEqual([]);
    expect(JSON.stringify(selected)).toContain("private owner text");
    await expect(
      buildAiContext(
        owner,
        input({ contextMode: "selected_files", selectedFileIds: [foreignFile] }),
      ),
    ).rejects.toThrow("unavailable");
  });
  it("persists real provider replies and applies actions only once", async () => {
    const provider: typeof fetch = async (url, init) => {
      expect(url).toBe("https://api.deepseek.com/chat/completions");
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("deepseek-v4-flash");
      expect(body).not.toHaveProperty("apiKey");
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "এখানে আপনার নোটের খসড়া।",
                actions: [
                  {
                    type: "create_note",
                    title: "Action fixture",
                    content: "বাংলা নোট",
                    category: "Cloud",
                    pinned: false,
                  },
                  {
                    type: "update_file_metadata",
                    fileId: foreignFile,
                    changes: { title: "Forbidden" },
                  },
                ],
              }),
            },
          },
        ],
      });
    };
    const result = await sendChat(
      owner,
      input({ message: "Create a note about my plan", contextMode: "everything" }),
      provider,
    );
    expect(result.message?.content).toContain("নোট");
    expect(result.message?.actions).toHaveLength(1);
    const actionId = result.message!.actions[0].id;
    await expect(executeChatAction(other, actionId)).rejects.toThrow("unavailable");
    const applied = await executeChatAction(owner, actionId);
    expect(applied.alreadyApplied).toBe(false);
    expect((await executeChatAction(owner, actionId)).alreadyApplied).toBe(true);
    expect(await db.entry.count({ where: { userId: owner, title: "Action fixture" } })).toBe(1);
    expect((await db.vaultFile.findUniqueOrThrow({ where: { id: foreignFile } })).title).toBe(
      "Foreign file",
    );
  });
  it("reports provider failures without inventing assistant messages and clears the busy lease", async () => {
    const before = await db.chatMessage.count({ where: { threadId, role: "assistant" } });
    await expect(
      sendChat(
        owner,
        input(),
        async () => new Response("sensitive upstream detail", { status: 401 }),
      ),
    ).rejects.toThrow("rejected the API key");
    expect(await db.chatMessage.count({ where: { threadId, role: "assistant" } })).toBe(before);
    expect(
      (await db.chatThread.findUniqueOrThrow({ where: { id: threadId } })).busyUntil,
    ).toBeNull();
    await expect(
      sendChat(other, input(), async () => {
        throw new Error("must not call");
      }),
    ).rejects.toThrow("API key");
  });
  it("exports without keys or binaries, restores a full backup, and preserves edits on repeated restore", async () => {
    const habit = await db.entry.create({
      data: {
        userId: owner,
        kind: "habit",
        title: "Fixture habit",
        details: { frequency: "daily", target: 1 },
      },
    });
    const learning = await db.entry.create({
      data: { userId: owner, kind: "learning", title: "Fixture learning" },
    });
    await db.habitLog.create({
      data: { userId: owner, entryId: habit.id, date: "2026-09-01", count: 1 },
    });
    await db.studySession.create({
      data: {
        userId: owner,
        entryId: learning.id,
        date: "2026-09-01",
        minutes: 25,
        notes: "Practice",
      },
    });
    await db.transaction.create({
      data: {
        userId: owner,
        title: "Fixture finance",
        type: "expense",
        amount: 12.5,
        category: "Books",
        date: "2026-09-01",
      },
    });
    await db.budget.create({
      data: { userId: owner, category: "Books", month: "2026-09", amount: 100 },
    });
    await db.savingGoal.create({
      data: { userId: owner, title: "Fixture saving", targetAmount: 500, savedAmount: 50 },
    });
    await db.dailyPlan.create({
      data: { userId: owner, date: "2026-09-01", priorities: ["Read"], schedule: "Morning" },
    });
    const raw = await exportWorkspace(owner);
    const json = JSON.stringify(raw);
    expect(json).not.toContain("keyCipher");
    expect(json).not.toContain("passwordHash");
    expect(json).not.toContain("fixture-api-key");
    expect(json).not.toContain("private owner text");
    const payload = backupSchema.parse(raw);
    expect((await restoreWorkspace(restoreOwner, payload)).dryRun).toBe(true);
    expect(await db.entry.count({ where: { userId: restoreOwner } })).toBe(0);
    await restoreWorkspace(restoreOwner, payload, false);
    const restored = await db.entry.findFirstOrThrow({
      where: { userId: restoreOwner, title: "Owner cloud" },
    });
    await db.entry.update({ where: { id: restored.id }, data: { title: "Keep edited title" } });
    const again = await restoreWorkspace(restoreOwner, payload, false);
    expect(again.added).toBeDefined();
    expect(Object.values(again.added ?? {}).every((count) => count === 0)).toBe(true);
    expect((await db.entry.findUniqueOrThrow({ where: { id: restored.id } })).title).toBe(
      "Keep edited title",
    );
    const same = await restoreWorkspace(owner, payload, false);
    expect(Object.values(same.added ?? {}).every((count) => count === 0)).toBe(true);
    expect(await db.studySession.count({ where: { userId: restoreOwner } })).toBe(1);
    expect(await db.transaction.count({ where: { userId: restoreOwner } })).toBe(1);
  }, 60000);
  it("rejects over-limit chat restores before creating any records", async () => {
    await db.chatThread.createMany({
      data: Array.from({ length: 100 }, () => ({ userId: other })),
    });
    const raw = await exportWorkspace(owner);
    raw.entries.push({ id: randomUUID(), kind: "note", title: "Must not partially restore" });
    const payload = backupSchema.parse(raw);
    const before = await db.entry.count({ where: { userId: other } });
    await expect(restoreWorkspace(other, payload)).rejects.toThrow("exceed 100 chats");
    await expect(restoreWorkspace(other, payload, false)).rejects.toThrow("exceed 100 chats");
    expect(await db.entry.count({ where: { userId: other } })).toBe(before);
    expect(await db.chatThread.count({ where: { userId: other } })).toBe(100);
    const duplicate = backupSchema.parse({ ...raw, chats: [raw.chats[0], raw.chats[0]] });
    await expect(restoreWorkspace(other, duplicate, false)).rejects.toThrow("Duplicate chat IDs");
  });
  it("deduplicates a scheduled slot and generates current plans without the ended exam", async () => {
    const first = await runAutomation(owner, "ai_daily_planner", "fixture-slot");
    const repeat = await runAutomation(owner, "ai_daily_planner", "fixture-slot");
    expect(repeat.id).toBe(first.id);
    const note = await db.entry.findUniqueOrThrow({
      where: { id: (first.details as { noteId: string }).noteId },
    });
    expect(note.notes).not.toContain("Midterm");
    expect(note.category).toBe("Routine");
    expect(await db.notification.count({ where: { userId: other } })).toBe(0);
    await expect(runAutomation(owner, "exam_countdown")).rejects.toThrow("Unknown");
  });
});
