"use client";
import { useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Minus,
  Pencil,
  Plus,
  Repeat2,
} from "lucide-react";
import type { Entry, HabitLog } from "@/lib/contracts";
import { addDays, dateLabel, today } from "@/lib/client";
import { todayInTimezone } from "@/lib/dates";
import { useWorkspace } from "./workspace";
import { PageHeading } from "./entry-collection";
import { Button, Empty, Progress } from "./ui";

export function weekStart(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}
export function habitStats(entry: Entry, logs: HabitLog[], date: string, timezone = "Asia/Dhaka") {
  const weekly = entry.details.frequency === "weekly";
  const target = entry.details.target ?? 1;
  const step = weekly ? 7 : 1;
  const start = weekly ? weekStart(date) : date;
  const countFor = (period: string) =>
    logs
      .filter(
        (log) =>
          log.entryId === entry.id &&
          log.date >= period &&
          log.date <= (weekly ? addDays(period, 6) : period) &&
          log.date <= date,
      )
      .reduce((sum, log) => sum + log.count, 0);
  const count = countFor(start);
  let streak = 0;
  let cursor = count >= target ? start : addDays(start, -step);
  while (streak < 10000 && countFor(cursor) >= target) {
    streak++;
    cursor = addDays(cursor, -step);
  }
  const periods = Array.from({ length: weekly ? 4 : 28 }, (_, index) =>
    addDays(start, -index * step),
  ).filter(
    (period) =>
      (weekly ? addDays(period, 6) : period) >=
      (entry.startDate ?? todayInTimezone(timezone, new Date(entry.createdAt))),
  );
  const completed = periods.filter((period) => countFor(period) >= target).length;
  return {
    count,
    target,
    weekly,
    streak,
    rate: periods.length ? Math.round((completed / periods.length) * 100) : 0,
    periods: periods.length,
  };
}
export function Habits() {
  const { data, edit, mutate, notify } = useWorkspace();
  const currentDate = today(data.user.timezone);
  const [date, setDate] = useState(currentDate);
  const [status, setStatus] = useState("active");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const habits = data.entries.filter(
    (item) =>
      item.kind === "habit" &&
      (status === "all" || !["done", "archived"].includes(item.status)) &&
      `${item.title} ${item.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  const days = Array.from({ length: 14 }, (_, i) => addDays(date, i - 13));
  async function record(id: string, count: number) {
    setBusyId(id);
    try {
      await mutate("/api/habit-logs", "POST", { entryId: id, date, count: Math.max(0, count) });
      notify("Habit history updated.");
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="Show up for yourself"
        title="Habits"
        description="Small actions. Meaningful consistency. Track a day or a whole week."
        action={
          <Button onClick={() => edit({ kind: "habit" })}>
            <Plus size={17} />
            New habit
          </Button>
        }
      />
      <div className="habit-toolbar">
        <div className="date-control">
          <button
            className="icon-button"
            aria-label="Previous day"
            onClick={() => setDate(addDays(date, -1))}
          >
            <ChevronLeft size={18} />
          </button>
          <input
            aria-label="Habit tracking date"
            type="date"
            value={date}
            max={currentDate}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
          <button
            className="icon-button"
            aria-label="Next day"
            disabled={date >= currentDate}
            onClick={() => setDate(addDays(date, 1))}
          >
            <ChevronRight size={18} />
          </button>
          <Button className="ghost" onClick={() => setDate(currentDate)}>
            Today
          </Button>
        </div>
        <div className="inline-actions">
          <input
            className="habit-search"
            aria-label="Search habits"
            placeholder="Find a habit…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="Habit status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="active">Current habits</option>
            <option value="all">All habits</option>
          </select>
        </div>
      </div>
      {habits.length === 0 ? (
        <div className="card">
          <Empty
            title="Start small. Keep going."
            onAdd={() => edit({ kind: "habit" })}
            action="Create a habit"
          >
            Choose a daily or weekly habit and a realistic target. Your history will appear as you
            record it.
          </Empty>
        </div>
      ) : (
        <div className="habits-list">
          {habits.map((entry) => {
            const stats = habitStats(entry, data.habitLogs, date, data.user.timezone);
            const count =
              data.habitLogs.find((log) => log.entryId === entry.id && log.date === date)?.count ??
              0;
            return (
              <article key={entry.id} className="card habit-card">
                <div className="habit-heading">
                  <span className="habit-icon">
                    <Repeat2 size={21} />
                  </span>
                  <div>
                    <h3>{entry.title}</h3>
                    <p>
                      {entry.category ? `${entry.category} · ` : ""}
                      {stats.target} time{stats.target === 1 ? "" : "s"} per{" "}
                      {stats.weekly ? "week" : "day"}
                    </p>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Edit ${entry.title}`}
                    onClick={() => edit({ kind: "habit", entry })}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
                {entry.notes && <p className="muted">{entry.notes}</p>}
                <div className="habit-record">
                  <div>
                    <span className="muted">
                      {date === currentDate ? "Today" : dateLabel(date)}
                    </span>
                    <div className="counter">
                      <button
                        className="icon-button"
                        aria-label={`Decrease ${entry.title} count`}
                        disabled={count === 0 || busyId === entry.id}
                        onClick={() => record(entry.id, count - 1)}
                      >
                        <Minus size={16} />
                      </button>
                      <strong>{count}</strong>
                      <button
                        className="icon-button"
                        aria-label={`Increase ${entry.title} count`}
                        disabled={busyId === entry.id || date > currentDate}
                        onClick={() => record(entry.id, count + 1)}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="habit-period-progress">
                    <Progress
                      value={(stats.count / stats.target) * 100}
                      label={`${stats.weekly ? "This week" : "This day"}: ${stats.count} / ${stats.target}`}
                    />
                  </div>
                  <div className="habit-streak">
                    <Flame size={19} />
                    <strong>{stats.streak}</strong>
                    <span>{stats.weekly ? "week" : "day"} streak</span>
                  </div>
                </div>
                <div className="habit-history" aria-label="Last 14 days">
                  {days.map((day) => {
                    const n =
                      data.habitLogs.find((log) => log.entryId === entry.id && log.date === day)
                        ?.count ?? 0;
                    return (
                      <button
                        key={day}
                        className={`history-day ${n > 0 ? "recorded" : ""} ${n >= stats.target && !stats.weekly ? "reached" : ""} ${day === date ? "selected" : ""}`}
                        title={`${dateLabel(day)}: ${n} recorded`}
                        aria-label={`${dateLabel(day)}: ${n} recorded. Select date.`}
                        onClick={() => setDate(day)}
                      >
                        <span>{dateLabel(day, { weekday: "narrow" })}</span>
                        <strong>{n > 0 ? <Check size={15} /> : day.slice(8)}</strong>
                      </button>
                    );
                  })}
                </div>
                <div className="habit-footer">
                  <span>Last 14 days · select a day to edit</span>
                  <strong>
                    {stats.rate}% target success{" "}
                    <small>
                      ({stats.periods} {stats.weekly ? "weeks" : "days"})
                    </small>
                  </strong>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
