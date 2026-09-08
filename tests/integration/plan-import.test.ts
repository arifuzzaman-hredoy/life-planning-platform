import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { migrationConnectionString } from "../../src/lib/database-url";
import { importedEntryId, importPlan } from "../../scripts/lib/plan-import";

describe.runIf(process.env.RUN_DB_TESTS === "true")("PostgreSQL plan import", () => {
  let db: PrismaClient;
  const ownerId = randomUUID(),
    otherId = randomUUID();
  const email = `import-${ownerId}@example.invalid`;
  const source = `test-${ownerId}`;
  const manifest = {
    version: 1,
    source,
    records: [
      { key: "goal", entry: { kind: "goal", title: "Original goal", progress: 32 } },
      {
        key: "project",
        entry: { kind: "project", title: "Original project", notes: "আমার পরিকল্পনা" },
        links: { goal: "goal" },
      },
    ],
  };
  beforeAll(async () => {
    db = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: migrationConnectionString(process.env.DATABASE_URL!),
      }),
      log: [],
    });
    await db.user.createMany({
      data: [
        { id: ownerId, email, name: "Import test", passwordHash: "unused-test-account" },
        {
          id: otherId,
          email: `other-${otherId}@example.invalid`,
          name: "Other test",
          passwordHash: "unused-test-account",
        },
      ],
    });
  });
  afterAll(async () => {
    if (!db) return;
    await db.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    await db.$disconnect();
  });
  it("dry-runs without writes, commits linked data, and preserves user edits on re-import", async () => {
    expect(await importPlan(db, manifest, email)).toMatchObject({
      wouldAdd: 2,
      added: 0,
      ownerEntriesAfter: 0,
    });
    expect(await importPlan(db, manifest, email, true)).toMatchObject({
      added: 2,
      ownerEntriesAfter: 2,
    });
    const projectId = importedEntryId(ownerId, source, "project");
    expect(await db.entry.findUnique({ where: { id: projectId } })).toMatchObject({
      notes: "আমার পরিকল্পনা",
      goalId: importedEntryId(ownerId, source, "goal"),
    });
    const edited = await db.entry.update({
      where: { id: projectId },
      data: { title: "User changed this", notes: "Keep my edits", progress: 71 },
    });
    expect(await importPlan(db, manifest, email, true)).toMatchObject({
      added: 0,
      existing: 2,
      ownerEntriesAfter: 2,
    });
    expect(await db.entry.findUnique({ where: { id: projectId } })).toMatchObject({
      title: edited.title,
      notes: edited.notes,
      progress: 71,
      updatedAt: edited.updatedAt,
    });
    expect(await db.entry.count({ where: { userId: otherId } })).toBe(0);
  });
  it("refuses another account's conflicting import ID without adding a partial plan", async () => {
    const collisionSource = source + "-collision";
    const collisionId = importedEntryId(ownerId, collisionSource, "project");
    await db.entry.create({
      data: { id: collisionId, userId: otherId, kind: "project", title: "Other account record" },
    });
    const before = await db.entry.count({ where: { userId: ownerId } });
    await expect(
      importPlan(db, { ...manifest, source: collisionSource }, email, true),
    ).rejects.toThrow("conflicts");
    expect(await db.entry.count({ where: { userId: ownerId } })).toBe(before);
    expect(await db.entry.findUnique({ where: { id: collisionId } })).toMatchObject({
      userId: otherId,
      title: "Other account record",
    });
  });
});
