"use client";
import { BookOpen, CheckCheck, Repeat2, Target } from "lucide-react";
import { useWorkspace } from "./workspace";
import { addDays, dateLabel, today } from "@/lib/client";
import { PageHeading } from "./entry-collection";
import { Stat } from "./dashboard";
import { Progress, Section } from "./ui";
import { habitStats } from "./habits";
export function Analytics() {
  const { data } = useWorkspace();
  const date = today(data.user.timezone);
  const days = Array.from({ length: 14 }, (_, i) => addDays(date, i - 13));
  const tasks = data.entries.filter((e) => e.kind === "task" && e.status !== "archived");
  const done = tasks.filter((e) => e.status === "done");
  const goals = data.entries.filter((e) => e.kind === "goal" && e.status !== "archived");
  const habits = data.entries.filter(
    (e) => e.kind === "habit" && !["done", "archived"].includes(e.status),
  );
  const minutes = data.studySessions.reduce((sum, s) => sum + s.minutes, 0);
  const studyDays = days.map((day) => ({
    day,
    minutes: data.studySessions
      .filter((s) => s.date === day)
      .reduce((sum, s) => sum + s.minutes, 0),
  }));
  const max = Math.max(60, ...studyDays.map((s) => s.minutes));
  const activeKinds = (
    ["goal", "task", "habit", "learning", "career", "project", "note", "event", "journal"] as const
  ).map((kind) => ({
    kind,
    count: data.entries.filter((e) => e.kind === kind && e.status !== "archived").length,
  }));
  return (
    <>
      <PageHeading
        eyebrow="Notice your progress"
        title="Insights"
        description="A thoughtful look at the activity you have recorded. Every number comes from your workspace."
      />
      <div className="stats-grid">
        <Stat
          label="Task completion"
          value={`${tasks.length ? Math.round((done.length / tasks.length) * 100) : 0}%`}
          hint={`${done.length} of ${tasks.length} non-archived tasks complete`}
          icon={CheckCheck}
        />
        <Stat
          label="Goal progress"
          value={`${goals.length ? Math.round(goals.reduce((sum, e) => sum + e.progress, 0) / goals.length) : 0}%`}
          hint="Average progress across non-archived goals"
          icon={Target}
          tone="blue"
        />
        <Stat
          label="Total study time"
          value={`${(minutes / 60).toFixed(1)}h`}
          hint={`${data.studySessions.length} recorded sessions · all time`}
          icon={BookOpen}
          tone="violet"
        />
        <Stat
          label="Current habits"
          value={habits.length}
          hint="Daily and weekly habits in your routine"
          icon={Repeat2}
          tone="amber"
        />
      </div>
      <div className="insights-grid">
        <Section title="Learning, a little at a time">
          <p className="section-description">Minutes studied each day · last 14 days</p>
          <div
            className="study-chart"
            role="img"
            aria-label={studyDays
              .map((d) => `${dateLabel(d.day)}: ${d.minutes} minutes`)
              .join(". ")}
          >
            {studyDays.map((d) => (
              <div
                className="chart-column"
                key={d.day}
                title={`${dateLabel(d.day)}: ${d.minutes} minutes`}
              >
                <span className="chart-value">{d.minutes || ""}</span>
                <div className="chart-track">
                  <span style={{ height: `${(d.minutes / max) * 100}%` }} />
                </div>
                <small>{d.day.slice(8)}</small>
              </div>
            ))}
          </div>
          {!studyDays.some((d) => d.minutes) && (
            <p className="chart-empty">Log a study session in Learning to start your chart.</p>
          )}
        </Section>
        <Section title="Habit consistency">
          {habits.length ? (
            <div className="insight-habits">
              {habits.map((habit) => {
                const stats = habitStats(habit, data.habitLogs, date, data.user.timezone);
                return (
                  <div key={habit.id}>
                    <div className="small-stat">
                      <strong>{habit.title}</strong>
                      <span>
                        {stats.streak} {stats.weekly ? "week" : "day"} streak
                      </span>
                    </div>
                    <Progress
                      value={stats.rate}
                      label={`${stats.periods} recent ${stats.weekly ? "weeks" : "days"} meeting target`}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted empty-small">
              Create a habit and record your activity to discover your patterns.
            </p>
          )}
        </Section>
        <Section title="Your workspace at a glance">
          <div className="workspace-counts">
            {activeKinds.map((item) => (
              <div key={item.kind}>
                <span>
                  {
                    {
                      goal: "Goals",
                      task: "Tasks",
                      habit: "Habits",
                      learning: "Learning items",
                      career: "Career items",
                      project: "Projects",
                      note: "Notes",
                      event: "Important dates",
                      journal: "Journal entries",
                    }[item.kind]
                  }
                </span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
          <p className="section-footnote">Counts exclude archived entries.</p>
        </Section>
        <Section title="Reflection & direction">
          <div className="reflection-stat">
            <strong>
              {data.entries.filter((e) => e.kind === "journal" && e.status !== "archived").length}
            </strong>
            <span>journal entries</span>
          </div>
          <div className="reflection-stat">
            <strong>{data.dailyPlans.filter((p) => p.reflection.trim()).length}</strong>
            <span>daily reflections</span>
          </div>
          <div className="reflection-stat">
            <strong>{data.dailyPlans.filter((p) => p.priorities.length).length}</strong>
            <span>days with priorities</span>
          </div>
          <p className="section-footnote">
            These are all-time totals. There is no perfect score—use them to notice what is helping
            you.
          </p>
        </Section>
      </div>
    </>
  );
}
