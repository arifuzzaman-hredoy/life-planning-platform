import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { ApiError } from "./errors";
import {
  entrySchema,
  habitLogSchema,
  studySessionSchema,
  transactionSchema,
  budgetSchema,
  savingSchema,
  dailyPlanSchema,
} from "./validation";
import { serializeRecord, publicUser } from "./serialize";
import { preparePlanImport } from "../../scripts/lib/plan-import";

const id = z.string().min(1).max(100);
const identified = <T extends z.ZodType<Record<string, unknown>>>(schema: T) =>
  z
    .object({ id })
    .passthrough()
    .transform((value, ctx) => {
      const { id: sourceId, createdAt, updatedAt, ...input } = value;
      void createdAt;
      void updatedAt;
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) ctx.addIssue({ ...issue, path: issue.path });
        return z.NEVER;
      }
      return { id: sourceId, ...(parsed.data as z.output<T>) };
    });
const entryExport = z
  .object({ id })
  .passthrough()
  .transform((value, ctx) => {
    const { id: sourceId, createdAt, updatedAt, ...input } = value;
    void createdAt;
    void updatedAt;
    const parsed = entrySchema.safeParse(input);
    if (!parsed.success) {
      ctx.addIssue({ code: "custom", message: "An entry in the backup is invalid" });
      return z.NEVER;
    }
    return { id: sourceId, entry: parsed.data };
  });
const chatBackup = z.object({
  id,
  title: z.string().max(100),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(24000) }))
    .max(1000),
});
export const backupSchema = z.object({
  formatVersion: z.union([z.literal(1), z.literal(2)]),
  user: z.object({ id }).passthrough(),
  exportedAt: z.string().optional(),
  entries: z.array(entryExport).max(5000),
  habitLogs: z.array(identified(habitLogSchema)).max(50000).default([]),
  studySessions: z.array(identified(studySessionSchema)).max(50000).default([]),
  transactions: z.array(identified(transactionSchema)).max(50000).default([]),
  budgets: z.array(identified(budgetSchema)).max(10000).default([]),
  savings: z.array(identified(savingSchema)).max(10000).default([]),
  dailyPlans: z.array(identified(dailyPlanSchema)).max(10000).default([]),
  chats: z.array(chatBackup).max(100).default([]),
});
export async function exportWorkspace(userId: string) {
  const where = { userId };
  const [
    user,
    entries,
    habitLogs,
    studySessions,
    transactions,
    budgets,
    savings,
    dailyPlans,
    chats,
  ] = await db.$transaction([
    db.user.findUniqueOrThrow({ where: { id: userId } }),
    db.entry.findMany({ where }),
    db.habitLog.findMany({ where }),
    db.studySession.findMany({ where }),
    db.transaction.findMany({ where }),
    db.budget.findMany({ where }),
    db.savingGoal.findMany({ where }),
    db.dailyPlan.findMany({ where }),
    db.chatThread.findMany({
      where,
      select: {
        id: true,
        title: true,
        messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } },
      },
    }),
  ]);
  return {
    formatVersion: 2,
    exportedAt: new Date().toISOString(),
    user: publicUser(user),
    entries: entries.map(serializeRecord),
    habitLogs: habitLogs.map(serializeRecord),
    studySessions: studySessions.map(serializeRecord),
    transactions: transactions.map(serializeRecord),
    budgets: budgets.map(serializeRecord),
    savings: savings.map(serializeRecord),
    dailyPlans: dailyPlans.map(serializeRecord),
    chats,
  };
}
export async function restoreWorkspace(
  userId: string,
  input: z.output<typeof backupSchema>,
  dryRun = true,
) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"entries:" + userId}))`;
      const ids = input.entries.map((row) => row.id);
      if (new Set(ids).size !== ids.length)
        throw new ApiError(400, "Duplicate entry IDs in backup");
      const existing = await tx.entry.findMany({
        where: { userId },
        select: { id: true, kind: true },
      });
      const own = new Map(existing.map((row) => [row.id, row.kind]));
      const remap = (sourceId: string) =>
        "restore_" +
        createHash("sha256")
          .update(JSON.stringify([userId, input.user.id, sourceId]))
          .digest("hex");
      const entryIds = new Map(
        ids.map((sourceId) => [sourceId, own.has(sourceId) ? sourceId : remap(sourceId)]),
      );
      const manifest = {
        version: 1,
        source: "backup-validation",
        records: input.entries.map((row) => ({
          key: row.id,
          entry: { ...row.entry, goalId: null, projectId: null, parentId: null },
          links: {
            ...(row.entry.goalId ? { goal: row.entry.goalId } : {}),
            ...(row.entry.projectId ? { project: row.entry.projectId } : {}),
            ...(row.entry.parentId ? { parent: row.entry.parentId } : {}),
          },
        })),
      };
      if (input.entries.length) preparePlanImport(manifest, userId);
      const rows = input.entries.map((row) => ({
        ...row.entry,
        progress: row.entry.status === "done" ? 100 : row.entry.progress,
        id: entryIds.get(row.id)!,
        userId,
        goalId: row.entry.goalId ? entryIds.get(row.entry.goalId)! : null,
        projectId: row.entry.projectId ? entryIds.get(row.entry.projectId)! : null,
        parentId: row.entry.parentId ? entryIds.get(row.entry.parentId)! : null,
      }));
      for (const row of rows)
        if (own.has(row.id) && own.get(row.id) !== row.kind)
          throw new ApiError(400, "An existing entry has a different type");
      const missing = rows.filter((row) => !own.has(row.id));
      for (const [collection, kind] of [
        [input.habitLogs, "habit"],
        [input.studySessions, "learning"],
      ] as const)
        for (const raw of collection) {
          const row = raw as { entryId: string };
          if (input.entries.find((entry) => entry.id === row.entryId)?.entry.kind !== kind)
            throw new ApiError(400, "A history record links to an invalid entry");
        }
      const summary = {
        entries: missing.length,
        habitLogs: input.habitLogs.length,
        studySessions: input.studySessions.length,
        transactions: input.transactions.length,
        budgets: input.budgets.length,
        savings: input.savings.length,
        dailyPlans: input.dailyPlans.length,
        chats: input.chats.length,
      };
      if (dryRun)
        return {
          dryRun: true,
          candidates: summary,
          message: "Existing records will be kept. Matching logs and finance records are skipped.",
        };
      if (missing.length) await tx.entry.createMany({ data: missing });
      // Validate again with exact schemas to retain typed data and prevent raw account IDs.
      const mapped = <T extends z.ZodType<Record<string, unknown>>>(
        items: { id: string }[],
        schema: T,
        existingIds: string[] = [],
      ) =>
        items
          .filter((raw) => !existingIds.includes(raw.id))
          .map((raw) => {
            const { id: sourceId, ...values } = raw;
            return { ...(schema.parse(values) as z.output<T>), id: remap(sourceId), userId };
          });
      const habitLogs = mapped(input.habitLogs, habitLogSchema) as (z.output<
        typeof habitLogSchema
      > & { id: string; userId: string })[];
      const oldStudies = await tx.studySession.findMany({
        where: { userId },
        select: { id: true },
      });
      const studies = mapped(
        input.studySessions,
        studySessionSchema,
        oldStudies.map((row) => row.id),
      );
      const counts: Record<string, number> = { entries: missing.length };
      counts.habitLogs = (
        await tx.habitLog.createMany({
          data: habitLogs.map((row) => ({ ...row, entryId: entryIds.get(row.entryId)! })),
          skipDuplicates: true,
        })
      ).count;
      counts.studySessions = (
        await tx.studySession.createMany({
          data: studies.map((row) => ({ ...row, entryId: entryIds.get(row.entryId)! })),
          skipDuplicates: true,
        })
      ).count;
      // Records already belonging to this account keep their original ID on a same-account restore.
      const [oldTransactions, oldBudgets, oldSavings, oldPlans] = await Promise.all([
        tx.transaction.findMany({ where: { userId }, select: { id: true } }),
        tx.budget.findMany({ where: { userId }, select: { id: true } }),
        tx.savingGoal.findMany({ where: { userId }, select: { id: true } }),
        tx.dailyPlan.findMany({ where: { userId }, select: { id: true } }),
      ]);
      counts.transactions = (
        await tx.transaction.createMany({
          data: mapped(
            input.transactions,
            transactionSchema,
            oldTransactions.map((row) => row.id),
          ),
          skipDuplicates: true,
        })
      ).count;
      counts.budgets = (
        await tx.budget.createMany({
          data: mapped(
            input.budgets,
            budgetSchema,
            oldBudgets.map((row) => row.id),
          ),
          skipDuplicates: true,
        })
      ).count;
      counts.savings = (
        await tx.savingGoal.createMany({
          data: mapped(
            input.savings,
            savingSchema,
            oldSavings.map((row) => row.id),
          ),
          skipDuplicates: true,
        })
      ).count;
      counts.dailyPlans = (
        await tx.dailyPlan.createMany({
          data: mapped(
            input.dailyPlans,
            dailyPlanSchema,
            oldPlans.map((row) => row.id),
          ),
          skipDuplicates: true,
        })
      ).count;
      let chatsAdded = 0;
      for (const chat of input.chats) {
        const existingChat = await tx.chatThread.findFirst({
          where: { userId, id: { in: [chat.id, remap(chat.id)] } },
          select: { id: true },
        });
        if (existingChat) continue;
        await tx.chatThread.create({
          data: {
            id: remap(chat.id),
            userId,
            title: chat.title,
            messages: { create: chat.messages },
          },
        });
        chatsAdded++;
      }
      counts.chats = chatsAdded;
      return { dryRun: false, added: counts };
    },
    { timeout: 120000, maxWait: 15000 },
  );
}
