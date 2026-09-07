export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function todayInTimezone(timezone = "Asia/Dhaka", now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function nextRecurrence(date: string, recurrence: "daily" | "weekly" | "monthly"): string {
  if (recurrence !== "monthly") return addDays(date, recurrence === "daily" ? 1 : 7);
  const d = new Date(`${date}T12:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

export function weekStart(date: string): string {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -(weekday === 0 ? 6 : weekday - 1));
}

export function habitStats(
  logs: { date: string; count: number }[],
  frequency: "daily" | "weekly",
  target: number,
  today: string,
  startDate?: string | null,
) {
  if (!Number.isInteger(target) || target < 1)
    throw new RangeError("Habit target must be a positive integer");
  const counts = new Map<string, number>();
  for (const log of logs) {
    if (log.date > today || (startDate && log.date < startDate)) continue;
    const key = frequency === "weekly" ? weekStart(log.date) : log.date;
    counts.set(key, (counts.get(key) ?? 0) + log.count);
  }
  const step = frequency === "weekly" ? 7 : 1;
  const current = frequency === "weekly" ? weekStart(today) : today;
  const currentCount = counts.get(current) ?? 0;
  let cursor = currentCount >= target ? current : addDays(current, -step);
  let streak = 0;
  while ((counts.get(cursor) ?? 0) >= target) {
    streak++;
    cursor = addDays(cursor, -step);
  }
  const first = startDate
    ? frequency === "weekly"
      ? weekStart(startDate)
      : startDate
    : ([...counts.keys()].sort()[0] ?? current);
  const days = Math.max(
    0,
    Math.round((Date.parse(`${current}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 86400000),
  );
  const elapsed = Math.floor(days / step) + 1;
  const complete = [...counts].filter(([date, count]) => date >= first && count >= target).length;
  return {
    streak,
    currentCount,
    target,
    consistency: Math.round((complete / elapsed) * 100),
    completedPeriods: complete,
    elapsedPeriods: elapsed,
  };
}
