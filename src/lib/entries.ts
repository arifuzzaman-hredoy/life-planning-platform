import type { Prisma } from "@/generated/prisma/client";
import type { EntryInput, EntryDetails } from "./contracts";
import { db } from "./db";
import { ApiError } from "./errors";
import { entrySchema, entryPatchSchema } from "./validation";
import { nextRecurrence, todayInTimezone } from "./dates";
import { serializeRecord } from "./serialize";

async function validateRelations(
  tx: Prisma.TransactionClient,
  userId: string,
  data: EntryInput,
  id?: string,
) {
  for (const [key, expectedKind] of [
    ["goalId", "goal"],
    ["projectId", "project"],
    ["parentId", null],
  ] as const) {
    const relatedId = data[key];
    if (!relatedId) continue;
    if (relatedId === id) throw new ApiError(400, "An entry cannot link to itself");
    const related = await tx.entry.findFirst({
      where: { id: relatedId, userId },
      select: { id: true, kind: true, parentId: true },
    });
    if (!related) throw new ApiError(400, "Linked entry is unavailable");
    if (expectedKind && related.kind !== expectedKind)
      throw new ApiError(400, `Choose a ${expectedKind} for this link`);
    if (key === "parentId") {
      if (
        related.kind !== data.kind &&
        !(data.kind === "task" && ["goal", "project"].includes(related.kind))
      )
        throw new ApiError(400, "Parent must have the same type, or be a goal/project for a task");
      let next = related.parentId;
      let depth = 0;
      const visited = new Set([related.id]);
      while (next) {
        if (next === id || visited.has(next))
          throw new ApiError(400, "Parent link would create a cycle");
        if (++depth > 100) throw new ApiError(400, "Entry hierarchy is too deep");
        visited.add(next);
        const parent = await tx.entry.findFirst({
          where: { id: next, userId },
          select: { parentId: true },
        });
        if (!parent) throw new ApiError(400, "Parent hierarchy is unavailable");
        next = parent.parentId;
      }
    }
  }
}

export async function createEntry(userId: string, raw: unknown) {
  const input = entrySchema.parse(raw);
  return db.$transaction(async (tx) => {
    // Serialize relation changes per owner, preventing concurrent hierarchy cycles.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"entries:" + userId}))`;
    await validateRelations(tx, userId, input);
    return tx.entry.create({
      data: { ...input, userId, progress: input.status === "done" ? 100 : input.progress },
    });
  });
}

export async function updateEntry(userId: string, id: string, raw: unknown, timezone: string) {
  const patch = entryPatchSchema.parse(raw);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"entries:" + userId}))`;
    const existing = await tx.entry.findFirst({ where: { id, userId } });
    if (!existing) throw new ApiError(404, "Entry not found");
    if (patch.kind && patch.kind !== existing.kind)
      throw new ApiError(400, "Entry type cannot be changed");
    const editable = serializeRecord(existing);
    delete editable.id;
    delete editable.createdAt;
    delete editable.updatedAt;
    const input = entrySchema.parse({ ...editable, ...patch });
    await validateRelations(tx, userId, input, id);
    const updated = await tx.entry.update({
      where: { id, userId },
      data: { ...input, progress: input.status === "done" ? 100 : input.progress },
    });
    const details = input.details as EntryDetails;
    const recurrence = details.recurrence;
    if (
      input.kind === "task" &&
      input.status === "done" &&
      existing.status !== "done" &&
      !existing.recurrenceGeneratedAt &&
      recurrence &&
      recurrence !== "none"
    ) {
      const targetDate = nextRecurrence(input.targetDate ?? todayInTimezone(timezone), recurrence);
      await tx.entry.create({
        data: {
          ...input,
          userId,
          status: "planned",
          progress: 0,
          targetDate,
          startDate: input.startDate ? nextRecurrence(input.startDate, recurrence) : null,
          recurrenceSourceId: id,
        },
      });
      await tx.entry.update({ where: { id, userId }, data: { recurrenceGeneratedAt: new Date() } });
    }
    return updated;
  });
}
