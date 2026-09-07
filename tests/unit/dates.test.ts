import { describe, expect, it } from "vitest";
import {
  addDays,
  habitStats,
  isDateOnly,
  nextRecurrence,
  todayInTimezone,
  weekStart,
} from "@/lib/dates";

describe("calendar arithmetic", () => {
  it.each(["2026-02-29", "2026-04-31", "2026-13-01", "2026-1-01", "tomorrow"])(
    "rejects invalid date %s",
    (value) => expect(isDateOnly(value)).toBe(false),
  );
  it("handles leap years, month ends and year boundaries", () => {
    expect(isDateOnly("2024-02-29")).toBe(true);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(nextRecurrence("2024-01-31", "monthly")).toBe("2024-02-29");
    expect(nextRecurrence("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextRecurrence("2026-12-31", "weekly")).toBe("2027-01-07");
    expect(nextRecurrence("2026-09-07", "daily")).toBe("2026-09-08");
  });
  it("uses the owner's timezone at midnight", () => {
    const now = new Date("2026-09-07T19:00:00Z");
    expect(todayInTimezone("Asia/Dhaka", now)).toBe("2026-09-08");
    expect(todayInTimezone("America/New_York", now)).toBe("2026-09-07");
  });
  it("starts weeks on Monday including a Sunday input", () => {
    expect(weekStart("2026-09-13")).toBe("2026-09-07");
    expect(weekStart("2026-09-07")).toBe("2026-09-07");
  });
});

describe("habit progress", () => {
  it("preserves yesterday's streak while today's target remains open", () => {
    expect(
      habitStats(
        [
          { date: "2026-09-05", count: 2 },
          { date: "2026-09-06", count: 2 },
          { date: "2026-09-07", count: 1 },
        ],
        "daily",
        2,
        "2026-09-07",
        "2026-09-05",
      ),
    ).toEqual({
      streak: 2,
      currentCount: 1,
      target: 2,
      consistency: 67,
      completedPeriods: 2,
      elapsedPeriods: 3,
    });
  });
  it("resets a streak after a missed full period", () => {
    expect(
      habitStats([{ date: "2026-09-05", count: 1 }], "daily", 1, "2026-09-07", "2026-09-05").streak,
    ).toBe(0);
  });
  it("aggregates weekly counts, excluding future and pre-start logs", () => {
    const logs = [
      { date: "2026-09-06", count: 50 },
      { date: "2026-09-07", count: 1 },
      { date: "2026-09-08", count: 2 },
      { date: "2026-09-10", count: 50 },
    ];
    expect(habitStats(logs, "weekly", 3, "2026-09-09", "2026-09-07")).toMatchObject({
      streak: 1,
      currentCount: 3,
      consistency: 100,
      completedPeriods: 1,
    });
  });
  it("handles no history and rejects zero targets without looping forever", () => {
    expect(habitStats([], "daily", 1, "2026-09-07")).toMatchObject({
      streak: 0,
      currentCount: 0,
      consistency: 0,
    });
    expect(() => habitStats([], "daily", 0, "2026-09-07")).toThrow(RangeError);
  });
});
