"use client";
import { useEffect, useState } from "react";
import { Bell, Play, Save } from "lucide-react";
import { api } from "@/lib/client";
import { automationSettingsSchema } from "@/lib/feature-validation";
import { z } from "zod";
import { Button, ErrorMessage, Field, Section } from "./ui";
import { PageHeading } from "./entry-collection";
import { useWorkspace } from "./workspace";
type Settings = z.infer<typeof automationSettingsSchema>;
type AutomationData = {
  settings: Settings;
  schedulerConfigured: boolean;
  jobs: { id: string; title: string; description: string; cadence: string }[];
  runs: { id: string; jobId: string; status: string; summary: string; createdAt: string }[];
  notifications: {
    id: string;
    title: string;
    message: string;
    readAt: string | null;
    createdAt: string;
  }[];
};
export function AutomationHub() {
  const [data, setData] = useState<AutomationData | null>(null);
  const [settings, setSettings] = useState<Settings>(automationSettingsSchema.parse({}));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const { refresh, notify } = useWorkspace();
  async function load() {
    const next = await api<AutomationData>("/api/automation");
    setData(next);
    setSettings(next.settings);
  }
  useEffect(() => {
    api<AutomationData>("/api/automation")
      .then((next) => {
        setData(next);
        setSettings(next.settings);
      })
      .catch((err) => setError(err.message));
  }, []);
  async function run(jobId: string) {
    setBusy(jobId);
    setError("");
    try {
      await api("/api/automation", "POST", { jobId });
      await load();
      await refresh();
      notify("Automation finished.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy("save");
    setError("");
    try {
      await api("/api/automation", "PUT", settings);
      await load();
      notify("Automation settings saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="Make consistency easier"
        title="Automation Hub"
        description="Run helpful routines, choose a schedule, and see what happened."
      />
      <ErrorMessage error={error} />
      <div className="feature-actions">
        <Button busy={busy === "all"} disabled={Boolean(busy)} onClick={() => void run("all")}>
          <Play size={16} />
          Run all routines
        </Button>
        <Button
          className="secondary"
          disabled={Boolean(busy)}
          onClick={() => void run("test_notification")}
        >
          <Bell size={16} />
          Test notification
        </Button>
      </div>
      <div className="entry-grid">
        {data?.jobs.map((job) => (
          <Section key={job.id} title={job.title}>
            <p className="section-description">{job.description}</p>
            <p className="muted">{job.cadence}</p>
            <Button
              className="secondary"
              disabled={Boolean(busy)}
              busy={busy === job.id}
              onClick={() => void run(job.id)}
            >
              Run now
            </Button>
          </Section>
        ))}
      </div>
      <div className="feature-columns">
        <Section title="Schedule">
          <form className="settings-form" onSubmit={save}>
            <label className="check-label">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })}
              />
              Enable scheduled routines
            </label>
            <p className="muted">
              {data?.schedulerConfigured
                ? "The server scheduler is connected. Times use your account timezone."
                : "Manual runs are available. Server scheduling is not connected yet."}
            </p>
            <Field label="Morning reminder">
              <input
                type="time"
                value={settings.dailyReminderTime}
                onChange={(event) =>
                  setSettings({ ...settings, dailyReminderTime: event.target.value })
                }
              />
            </Field>
            <Field label="Night review">
              <input
                type="time"
                value={settings.nightReviewTime}
                onChange={(event) =>
                  setSettings({ ...settings, nightReviewTime: event.target.value })
                }
              />
            </Field>
            <Field label="Weekly review day">
              <select
                value={settings.weeklyReviewDay}
                onChange={(event) =>
                  setSettings({ ...settings, weeklyReviewDay: Number(event.target.value) })
                }
              >
                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
                  (day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Weekly review time">
              <input
                type="time"
                value={settings.weeklyReviewTime}
                onChange={(event) =>
                  setSettings({ ...settings, weeklyReviewTime: event.target.value })
                }
              />
            </Field>
            {data?.jobs.map((job) => (
              <label className="check-label" key={job.id}>
                <input
                  type="checkbox"
                  checked={(settings.enabledJobs as string[]).includes(job.id)}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      enabledJobs: event.target.checked
                        ? [...settings.enabledJobs, job.id as Settings["enabledJobs"][number]]
                        : settings.enabledJobs.filter((id) => id !== job.id),
                    })
                  }
                />
                {job.title}
              </label>
            ))}
            <Button type="submit" busy={busy === "save"}>
              <Save size={16} />
              Save schedule
            </Button>
          </form>
        </Section>
        <Section
          title="Notifications"
          action={
            <button
              className="text-link"
              onClick={() =>
                void api("/api/notifications", "PATCH", {})
                  .then(load)
                  .catch((err) => setError(err.message))
              }
            >
              Mark all read
            </button>
          }
        >
          {data?.notifications.length ? (
            data.notifications.map((note) => (
              <article className="feature-log" key={note.id}>
                <strong>{note.title}</strong>
                <p>{note.message}</p>
                <small>{new Date(note.createdAt).toLocaleString()}</small>
                {!note.readAt && (
                  <button
                    className="text-link"
                    onClick={() =>
                      void api("/api/notifications", "PATCH", { id: note.id })
                        .then(load)
                        .catch((err) => setError(err.message))
                    }
                  >
                    Mark read
                  </button>
                )}
              </article>
            ))
          ) : (
            <p className="muted">Notifications from your routines will appear here.</p>
          )}
        </Section>
      </div>
      <Section title="Run history">
        {data?.runs.length ? (
          data.runs.map((run) => (
            <article className="feature-log" key={run.id}>
              <span className="badge">{run.status}</span>
              <strong>{data.jobs.find((job) => job.id === run.jobId)?.title}</strong>
              <p>{run.summary}</p>
              <small>{new Date(run.createdAt).toLocaleString()}</small>
            </article>
          ))
        ) : (
          <p className="muted">Run a routine to see its result here.</p>
        )}
      </Section>
    </>
  );
}
