import { createHash } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { entrySchema } from "../../src/lib/validation";

const key = z.string().min(1).max(200);
export const planImportSchema = z
  .object({
    version: z.literal(1),
    source: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,79}$/),
    records: z
      .array(
        z
          .object({
            key,
            entry: entrySchema,
            links: z
              .object({ goal: key.optional(), project: key.optional(), parent: key.optional() })
              .strict()
              .default({}),
          })
          .strict(),
      )
      .min(1)
      .max(5000),
  })
  .strict();

export function importedEntryId(ownerId: string, source: string, sourceKey: string) {
  return (
    "import_" +
    createHash("sha256")
      .update(JSON.stringify([ownerId, source, sourceKey]))
      .digest("hex")
  );
}

export function preparePlanImport(raw: unknown, ownerId: string) {
  const manifest = planImportSchema.parse(raw);
  const byKey = new Map(manifest.records.map((record) => [record.key, record]));
  if (byKey.size !== manifest.records.length) throw new Error("Duplicate source keys");
  const records = manifest.records.map((record) => {
    if (record.entry.goalId || record.entry.projectId || record.entry.parentId)
      throw new Error("Use source links, not database IDs");
    const links: Record<string, string> = {};
    for (const [relation, sourceKey] of Object.entries(record.links)) {
      const related = byKey.get(sourceKey);
      if (!related || related === record)
        throw new Error("Missing or self-referencing source link");
      if ((relation === "goal" || relation === "project") && related.entry.kind !== relation)
        throw new Error("Source link has the wrong entry type");
      if (
        relation === "parent" &&
        related.entry.kind !== record.entry.kind &&
        !(record.entry.kind === "task" && ["goal", "project"].includes(related.entry.kind))
      )
        throw new Error("Invalid parent entry type");
      links[relation + "Id"] = importedEntryId(ownerId, manifest.source, sourceKey);
    }
    const visited = new Set([record.key]);
    let parent = record.links.parent;
    while (parent) {
      if (visited.has(parent) || visited.size > 100)
        throw new Error("Cyclic or excessively deep parent links");
      visited.add(parent);
      parent = byKey.get(parent)?.links.parent;
    }
    return {
      ...record.entry,
      ...links,
      progress: record.entry.status === "done" ? 100 : record.entry.progress,
      id: importedEntryId(ownerId, manifest.source, record.key),
      userId: ownerId,
    };
  });
  return { source: manifest.source, records };
}

// A single transaction adds missing records. Re-imports never overwrite user edits.
// Source IDs are owner-scoped; links cannot point to another account's records.
export async function importPlan(db: PrismaClient, raw: unknown, email: string, commit = false) {
  const ownerEmail = z.email().parse(email.trim().toLowerCase());
  return db.$transaction(
    async (tx) => {
      const owner = await tx.user.findUnique({
        where: { email: ownerEmail },
        select: { id: true },
      });
      if (!owner) throw new Error("Import owner does not exist");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"entries:" + owner.id}))`;
      const plan = preparePlanImport(raw, owner.id);
      const existing = await tx.entry.findMany({
        where: { id: { in: plan.records.map((record) => record.id) } },
        select: { id: true, userId: true, kind: true },
      });
      const existingById = new Map(existing.map((record) => [record.id, record]));
      for (const record of plan.records) {
        const match = existingById.get(record.id);
        if (match && (match.userId !== owner.id || match.kind !== record.kind))
          throw new Error("An existing import ID conflicts with this plan");
      }
      const missing = plan.records.filter((record) => !existingById.has(record.id));
      const before = await tx.entry.count({ where: { userId: owner.id } });
      if (commit && missing.length) await tx.entry.createMany({ data: missing });
      const counts: Record<string, number> = {};
      for (const record of missing) counts[record.kind] = (counts[record.kind] ?? 0) + 1;
      return {
        mode: commit ? "committed" : "dry-run",
        source: plan.source,
        total: plan.records.length,
        existing: existing.length,
        added: commit ? missing.length : 0,
        wouldAdd: commit ? 0 : missing.length,
        byKind: counts,
        ownerEntriesBefore: before,
        ownerEntriesAfter: await tx.entry.count({ where: { userId: owner.id } }),
      };
    },
    { maxWait: 15000, timeout: 120000 },
  );
}
