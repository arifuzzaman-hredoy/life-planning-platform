import { describe, expect, it } from "vitest";
import { importedEntryId, preparePlanImport } from "../../scripts/lib/plan-import";

const sample = () => ({
  version: 1,
  source: "sample-roadmap",
  records: [
    { key: "goal", entry: { kind: "goal", title: "Learn", progress: 32 } },
    {
      key: "project",
      entry: { kind: "project", title: "Build", notes: "বাংলা পরিকল্পনা" },
      links: { goal: "goal" },
    },
  ],
});
describe("plan import boundaries", () => {
  it("preserves bilingual data and partial progress while linking stable owner-scoped IDs", () => {
    const plan = preparePlanImport(sample(), "owner-a");
    expect(plan.records[0].progress).toBe(32);
    expect(plan.records[1].notes).toBe("বাংলা পরিকল্পনা");
    expect(plan.records[1].goalId).toBe(plan.records[0].id);
    expect(plan.records[0].targetDate).toBeNull();
    expect(plan.records[0].id).toBe(importedEntryId("owner-a", "sample-roadmap", "goal"));
    expect(plan.records[0].id).not.toBe(preparePlanImport(sample(), "owner-b").records[0].id);
  });
  it("rejects duplicate keys and cross-account database links", () => {
    const duplicate = sample();
    duplicate.records.push(duplicate.records[0]);
    expect(() => preparePlanImport(duplicate, "owner")).toThrow("Duplicate");
    const foreign = {
      version: 1,
      source: "test",
      records: [{ key: "x", entry: { kind: "task", title: "x", goalId: "foreign-owner-goal" } }],
    };
    expect(() => preparePlanImport(foreign, "owner")).toThrow("database IDs");
  });
  it("rejects broken, incorrectly typed and cyclic relationships", () => {
    const invalid = sample();
    invalid.records[1].links = { goal: "missing" };
    expect(() => preparePlanImport(invalid, "owner")).toThrow("Missing");
    const wrong = {
      version: 1,
      source: "test",
      records: [
        { key: "a", entry: { kind: "task", title: "a" }, links: { goal: "b" } },
        { key: "b", entry: { kind: "task", title: "b" } },
      ],
    };
    expect(() => preparePlanImport(wrong, "owner")).toThrow("wrong entry type");
    const cycle = {
      version: 1,
      source: "test",
      records: [
        { key: "a", entry: { kind: "task", title: "a" }, links: { parent: "b" } },
        { key: "b", entry: { kind: "task", title: "b" }, links: { parent: "a" } },
      ],
    };
    expect(() => preparePlanImport(cycle, "owner")).toThrow("Cyclic");
  });
  it("applies app validation before database writes", () => {
    const bad = sample();
    bad.records[0].entry.progress = 101;
    expect(() => preparePlanImport(bad, "owner")).toThrow();
    expect(() => preparePlanImport({ ...sample(), credentials: "not-allowed" }, "owner")).toThrow();
  });
});
