"use client";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  CircleDollarSign,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";
import { useWorkspace } from "./workspace";
import { addDays, dateLabel, money, today, words } from "@/lib/client";
import { Empty, Progress, Section } from "./ui";
import { EntryRow, PageHeading } from "./entry-collection";

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "teal",
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: typeof Target;
  tone?: string;
}) {
  return (
    <div className="card stat">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${tone}`}>
          <Icon size={18} />
        </span>
      </div>
      <strong className="stat-value">{value}</strong>
      <small>{hint}</small>
    </div>
  );
}
export function Dashboard() {
  const { data, edit, mutate, notify } = useWorkspace();
  const date = today(data.user.timezone);
  const month = date.slice(0, 7);
  const active = data.entries.filter((item) => !["done", "archived"].includes(item.status));
  const tasks = active
    .filter((item) => item.kind === "task")
    .sort((a, b) => (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999"));
  const goals = active
    .filter((item) => item.kind === "goal")
    .sort((a, b) => b.progress - a.progress);
  const habits = active.filter((item) => item.kind === "habit");
  const transactions = data.transactions.filter(
    (item) => item.date.startsWith(month) && item.currency === data.user.currency,
  );
  const balance = transactions.reduce(
    (sum, item) => sum + (item.type === "income" ? item.amount : -item.amount),
    0,
  );
  const minutes = data.studySessions
    .filter((item) => item.date >= addDays(date, -6) && item.date <= date)
    .reduce((sum, item) => sum + item.minutes, 0);
  const plan = data.dailyPlans.find((item) => item.date === date);
  const upcoming = active
    .filter(
      (item) => item.targetDate && item.targetDate >= date && item.targetDate <= addDays(date, 30),
    )
    .sort((a, b) => a.targetDate!.localeCompare(b.targetDate!));
  const completedTasks = data.entries.filter(
    (item) => item.kind === "task" && item.status === "done",
  );
  return (
    <>
      <PageHeading
        eyebrow={dateLabel(date, { weekday: "long", day: "numeric", month: "long" })}
        title={`Welcome back, ${data.user.name.split(" ")[0]}.`}
        description="Everything that matters, in one place. Let's make a little progress."
        action={
          <Link href="/planner" className="button secondary">
            Plan my day <ArrowRight size={17} />
          </Link>
        }
      />
      <div className="stats-grid">
        <Stat
          label="Tasks to do"
          value={tasks.length}
          hint={`${tasks.filter((item) => item.targetDate && item.targetDate <= date).length} due today or earlier`}
          icon={CheckCheck}
        />
        <Stat
          label="Goals in motion"
          value={goals.length}
          hint={`${data.entries.filter((item) => item.kind === "goal" && item.status === "done").length} goals completed`}
          icon={Target}
          tone="blue"
        />
        <Stat
          label="Learning this week"
          value={
            <>
              {(minutes / 60).toFixed(1)}
              <em> hrs</em>
            </>
          }
          hint="Your recorded study time · last 7 days"
          icon={BookOpen}
          tone="violet"
        />
        <Stat
          label="Monthly balance"
          value={money(balance, data.user.currency)}
          hint="Recorded income minus expenses"
          icon={CircleDollarSign}
          tone="amber"
        />
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-primary">
          <Section title="Your focus today" href="/planner">
            <div className="focus-caption">
              <span className="tiny-dot" />
              {plan?.priorities.filter(Boolean).length
                ? "The things you chose to make time for"
                : "A clear day starts with a small plan"}
            </div>
            {plan?.priorities.filter(Boolean).length ? (
              <ol className="priority-list">
                {plan.priorities.filter(Boolean).map((priority, i) => (
                  <li key={`${priority}-${i}`}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {priority}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="focus-empty">
                <p>What are the three most important things you want to do today?</p>
                <Link href="/planner" className="text-link">
                  Set today’s priorities <ArrowRight size={15} />
                </Link>
              </div>
            )}
          </Section>
          <Section title="Next up" href="/tasks">
            {tasks.length ? (
              <div className="row-list">
                {tasks.slice(0, 5).map((item) => (
                  <EntryRow key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <Empty
                title="A little space to plan"
                action="Add a task"
                onAdd={() => edit({ kind: "task" })}
              >
                Capture something you want to get done. Small steps count.
              </Empty>
            )}
          </Section>
          <Section title="Goals in motion" href="/goals">
            {goals.length ? (
              <div className="goal-preview-grid">
                {goals.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    className="goal-preview"
                    onClick={() => edit({ kind: "goal", entry: item })}
                  >
                    <span className="badge">{item.category || words(item.period)}</span>
                    <h3>{item.title}</h3>
                    <Progress value={item.progress} label="Progress" />
                    <small>
                      {item.targetDate
                        ? `Target ${dateLabel(item.targetDate)}`
                        : "Give this goal a target date"}
                    </small>
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title="Give yourself a direction"
                action="Create a goal"
                onAdd={() => edit({ kind: "goal" })}
              >
                Start with one goal you care about, then break it into smaller milestones.
              </Empty>
            )}
          </Section>
          <Section title="What you are building" href="/projects">
            {active.filter((item) => item.kind === "project").length ? (
              active
                .filter((item) => item.kind === "project")
                .slice(0, 3)
                .map((item) => (
                  <div key={item.id} className="project-preview">
                    <EntryRow item={item} compact />
                    <Progress value={item.progress} />
                  </div>
                ))
            ) : (
              <div className="inline-empty">
                <p>No active projects yet.</p>
                <button className="text-link" onClick={() => edit({ kind: "project" })}>
                  Start a project <Plus size={14} />
                </button>
              </div>
            )}
          </Section>
        </div>
        <div className="dashboard-aside">
          <section className="daily-note">
            <span className="eyebrow">
              <Sparkles size={14} /> ONE STEP AT A TIME
            </span>
            <h2>
              Consistency makes
              <br />
              room for change.
            </h2>
            <p>Your workspace grows with you. Start with today’s plan and one small action.</p>
            <Link href="/journal">
              Take a moment to reflect <ArrowRight size={16} />
            </Link>
            <div className="note-decoration" aria-hidden="true">
              <div />
              <div />
              <div />
            </div>
          </section>
          <Section title="Today's habits" href="/habits">
            {habits.length ? (
              <div className="habit-mini-list">
                {habits.slice(0, 5).map((item) => {
                  const count =
                    data.habitLogs.find((log) => log.entryId === item.id && log.date === date)
                      ?.count ?? 0;
                  return (
                    <div className="habit-mini" key={item.id}>
                      <span className={`habit-mark ${count > 0 ? "completed" : ""}`}>
                        {count > 0 ? <Check size={16} /> : <span />}
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>
                          {count} recorded today · {item.details.frequency ?? "daily"}
                        </small>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`Record ${item.title}`}
                        onClick={async () => {
                          try {
                            await mutate("/api/habit-logs", "POST", {
                              entryId: item.id,
                              date,
                              count: count + 1,
                            });
                            notify("Habit recorded.");
                          } catch (err) {
                            notify((err as Error).message);
                          }
                        }}
                      >
                        <Plus size={17} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="inline-empty">
                <p>Build a routine, one habit at a time.</p>
                <button className="text-link" onClick={() => edit({ kind: "habit" })}>
                  Add a habit <Plus size={14} />
                </button>
              </div>
            )}
          </Section>
          <Section title="On the horizon" href="/timeline">
            {upcoming.length ? (
              <div className="upcoming-list">
                {upcoming.slice(0, 4).map((item) => (
                  <button key={item.id} onClick={() => edit({ kind: item.kind, entry: item })}>
                    <span className="date-block">
                      <strong>{item.targetDate!.slice(8)}</strong>
                      <small>{dateLabel(item.targetDate, { month: "short" })}</small>
                    </span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>
                        {words(item.kind)} · {words(item.priority)} priority
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="inline-empty">
                <p>No upcoming dates in the next 30 days.</p>
                <button className="text-link" onClick={() => edit({ kind: "event" })}>
                  Add an important date <Plus size={14} />
                </button>
              </div>
            )}
          </Section>
          <Section title="Your progress" href="/analytics">
            <div className="small-stat">
              <span>Tasks completed</span>
              <strong>{completedTasks.length}</strong>
            </div>
            <div className="small-stat">
              <span>Career items active</span>
              <strong>{active.filter((item) => item.kind === "career").length}</strong>
            </div>
            <div className="small-stat">
              <span>Reflections written</span>
              <strong>{data.entries.filter((item) => item.kind === "journal").length}</strong>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
