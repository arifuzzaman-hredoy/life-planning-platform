import { describe, expect, it } from "vitest";
import {
  budgetPatchSchema,
  dailyPlanSchema,
  entryPatchSchema,
  entrySchema,
  habitLogSchema,
  passwordSchema,
  profileSchema,
  savingPatchSchema,
  studySessionSchema,
  transactionPatchSchema,
  transactionSchema,
} from "@/lib/validation";

describe("entry validation", () => {
  it("normalizes titles and provides creation defaults", () => {
    expect(entrySchema.parse({ kind: "goal", title: "  Learn Kubernetes  " })).toMatchObject({
      title: "Learn Kubernetes",
      progress: 0,
      status: "planned",
      details: {},
      parentId: null,
    });
  });
  it("prevents cross-module fields, unexpected owner ids and unsafe links", () => {
    expect(
      entrySchema.safeParse({ kind: "note", title: "Note", details: { recurrence: "daily" } })
        .success,
    ).toBe(false);
    expect(
      entrySchema.safeParse({ kind: "goal", title: "Goal", userId: "another-user" }).success,
    ).toBe(false);
    for (const url of ["javascript:alert(1)", "data:text/html,hello", "file:///etc/passwd"])
      expect(entrySchema.safeParse({ kind: "note", title: "Note", url }).success).toBe(false);
  });
  it("checks date ordering and real dates", () => {
    expect(
      entrySchema.safeParse({
        kind: "task",
        title: "Task",
        startDate: "2026-09-08",
        targetDate: "2026-09-07",
      }).success,
    ).toBe(false);
    expect(
      entrySchema.safeParse({ kind: "task", title: "Task", targetDate: "2026-02-30" }).success,
    ).toBe(false);
  });
  it("does not clear relations when patching a different field", () => {
    expect(entryPatchSchema.parse({ title: "Renamed" })).toEqual({ title: "Renamed" });
    expect(entryPatchSchema.parse({ parentId: null })).toEqual({ parentId: null });
  });
});

describe("financial validation", () => {
  it("does not apply creation defaults to partial financial updates", () => {
    expect(savingPatchSchema.parse({ title: "New laptop" })).toEqual({ title: "New laptop" });
    expect(budgetPatchSchema.parse({ amount: 500 })).toEqual({ amount: 500 });
    expect(transactionPatchSchema.parse({ title: "Updated expense" })).toEqual({
      title: "Updated expense",
    });
  });
  it("keeps decimal currency values and rejects excess precision", () => {
    const transaction = {
      title: "Book",
      type: "expense",
      category: "Learning",
      date: "2026-09-07",
    };
    expect(transactionSchema.parse({ ...transaction, amount: 0.29 })).toMatchObject({
      amount: 0.29,
      currency: "BDT",
    });
    for (const amount of [0, -1, 1.234, Infinity, NaN])
      expect(transactionSchema.safeParse({ ...transaction, amount }).success).toBe(false);
    expect(
      transactionSchema.safeParse({ ...transaction, amount: 1, currency: "ZZZ" }).success,
    ).toBe(false);
  });
});

describe("preferences and logs", () => {
  it("requires supported timezones and strong passwords", () => {
    expect(profileSchema.safeParse({ timezone: "Moon/Crater" }).success).toBe(false);
    expect(
      passwordSchema.safeParse({ currentPassword: "old", newPassword: "alllettersbutlong" })
        .success,
    ).toBe(false);
    expect(
      passwordSchema.safeParse({ currentPassword: "old", newPassword: "Unique long phrase 42" })
        .success,
    ).toBe(true);
  });
  it("limits counts, session duration and priorities", () => {
    expect(habitLogSchema.safeParse({ entryId: "h", date: "2026-09-07", count: -1 }).success).toBe(
      false,
    );
    expect(
      studySessionSchema.safeParse({ entryId: "l", date: "2026-09-07", minutes: 1441 }).success,
    ).toBe(false);
    expect(
      dailyPlanSchema.safeParse({ date: "2026-09-07", priorities: Array(11).fill("Priority") })
        .success,
    ).toBe(false);
  });
});
