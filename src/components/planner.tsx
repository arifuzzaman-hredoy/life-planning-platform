"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Save } from "lucide-react";
import { addDays, dateLabel, today } from "@/lib/client";
import { useWorkspace } from "./workspace";
import { EntryRow, PageHeading } from "./entry-collection";
import { Button, ErrorMessage, Section } from "./ui";

export function Planner() {
  const { data } = useWorkspace();
  const [date, setDate] = useState(today(data.user.timezone));
  return <PlannerDay key={date} date={date} setDate={setDate} />;
}
function PlannerDay({ date, setDate }: { date: string; setDate: (value: string) => void }) {
  const { data, edit, mutate, notify } = useWorkspace();
  const plan = data.dailyPlans.find((item) => item.date === date);
  const [priorities, setPriorities] = useState<string[]>(() => {
    const p = plan?.priorities ?? [];
    return [p[0] ?? "", p[1] ?? "", p[2] ?? "", ...p.slice(3)];
  });
  const [schedule, setSchedule] = useState(plan?.schedule ?? "");
  const [notes, setNotes] = useState(plan?.notes ?? "");
  const [reflection, setReflection] = useState(plan?.reflection ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const tasks = data.entries.filter(
    (item) =>
      item.kind === "task" &&
      item.status !== "archived" &&
      (item.targetDate === date || item.startDate === date),
  );
  const goals = data.entries.filter(
    (item) =>
      item.kind === "goal" &&
      item.status !== "archived" &&
      (item.targetDate === date || item.startDate === date),
  );
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    function onNavigate(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        link.origin !== window.location.origin ||
        link.pathname === window.location.pathname
      )
        return;
      if (!window.confirm("You have unsaved changes. Leave this daily plan without saving?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", handler);
    document.addEventListener("click", onNavigate, true);
    return () => {
      window.removeEventListener("beforeunload", handler);
      document.removeEventListener("click", onNavigate, true);
    };
  }, [dirty]);
  function changeDate(next: string) {
    if (!next) return;
    if (dirty && !window.confirm("You have unsaved changes. Leave this day without saving?"))
      return;
    setDate(next);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await mutate("/api/daily-plans", "PUT", {
        date,
        priorities: priorities.filter((item) => item.trim()),
        schedule,
        notes,
        reflection,
      });
      setDirty(false);
      notify("Daily plan saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="Make today intentional"
        title="Daily planner"
        description="Choose your focus, give it time, and reflect on your day."
      />
      <div className="planner-date-bar">
        <div className="date-control">
          <button
            className="icon-button"
            aria-label="Previous day"
            onClick={() => changeDate(addDays(date, -1))}
          >
            <ChevronLeft size={18} />
          </button>
          <input
            type="date"
            aria-label="Planning date"
            value={date}
            onChange={(e) => changeDate(e.target.value)}
          />
          <button
            className="icon-button"
            aria-label="Next day"
            onClick={() => changeDate(addDays(date, 1))}
          >
            <ChevronRight size={18} />
          </button>
          <Button className="ghost" onClick={() => changeDate(today(data.user.timezone))}>
            Today
          </Button>
        </div>
        <span className="muted">
          {dateLabel(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </span>
      </div>
      <form onSubmit={save} onChange={() => setDirty(true)}>
        <div className="planner-grid">
          <div>
            <Section title="Today's priorities">
              <p className="section-description">Give your attention to what matters most.</p>
              <div className="priority-inputs">
                {priorities.map((value, i) => (
                  <label key={i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <input
                      aria-label={`Priority ${i + 1}`}
                      maxLength={300}
                      value={value}
                      placeholder={
                        i === 0
                          ? "The most important thing today…"
                          : "Another thing worth making time for…"
                      }
                      onChange={(e) =>
                        setPriorities((prev) =>
                          prev.map((p, index) => (index === i ? e.target.value : p)),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </Section>
            <Section title="Schedule">
              <p className="section-description">
                Write time blocks, appointments, or a simple plan for the day.
              </p>
              <textarea
                className="schedule-input"
                aria-label="Daily schedule"
                rows={10}
                maxLength={20000}
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder={"09:00 — Focus time\n12:30 — Lunch & a walk\n14:00 — Learning session"}
              />
            </Section>
            <Section title="Notes & thoughts">
              <textarea
                aria-label="Daily notes"
                rows={4}
                maxLength={20000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything else on your mind…"
              />
            </Section>
          </div>
          <div>
            <Section
              title="Tasks for this day"
              action={
                <button type="button" className="text-link" onClick={() => edit({ kind: "task" })}>
                  <Plus size={15} />
                  Add
                </button>
              }
            >
              {tasks.length ? (
                tasks.map((item) => <EntryRow key={item.id} item={item} compact />)
              ) : (
                <p className="muted empty-small">
                  No tasks scheduled for this date. Set a task’s start or target date to see it
                  here.
                </p>
              )}
              {tasks.length > 0 && (
                <p className="completion-caption">
                  {tasks.filter((item) => item.status === "done").length} of {tasks.length}{" "}
                  completed
                </p>
              )}
            </Section>
            <Section title="Goals for this day">
              {goals.length ? (
                goals.map((item) => <EntryRow key={item.id} item={item} compact />)
              ) : (
                <p className="muted empty-small">
                  Goals starting or due on this date will appear here.
                </p>
              )}
            </Section>
            <Section title="A moment to reflect" className="reflection-card">
              <p className="section-description">
                What went well? What did you learn? What could tomorrow look like?
              </p>
              <textarea
                aria-label="Daily reflection"
                rows={7}
                maxLength={20000}
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="Today I noticed…"
              />
            </Section>
          </div>
        </div>
        <div className="planner-save">
          <ErrorMessage error={error} />
          <span className="muted" role="status">
            {dirty ? "You have unsaved changes" : plan ? "All changes saved" : "Ready when you are"}
          </span>
          <Button type="submit" busy={busy}>
            <Save size={17} />
            Save daily plan
          </Button>
        </div>
      </form>
    </>
  );
}
