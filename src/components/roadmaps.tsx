"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Printer, Save } from "lucide-react";
import type { Entry, EntryDetails } from "@/lib/contracts";
import { roadmaps, progressStages, stageProgress, stageStatus } from "@/lib/roadmaps";
import { today } from "@/lib/client";
import { Button, ErrorMessage, Field, Progress, Section } from "./ui";
import { PageHeading } from "./entry-collection";
import { useWorkspace } from "./workspace";

export function RoadmapHub({ slug }: { slug?: string }) {
  const { data, edit } = useWorkspace();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const selected = roadmaps.find((roadmap) => roadmap.slug === slug);
  const entries = data.entries
    .filter(
      (entry) =>
        !selected ||
        (selected.categories as readonly string[]).includes(entry.category) ||
        (entry.category === "Document Vault" && entry.tags.includes(slug ?? "")),
    )
    .filter(
      (entry) =>
        (kind === "all" || entry.kind === kind) &&
        `${entry.title} ${entry.notes}`.toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <>
      <PageHeading
        eyebrow="Your original plan, connected"
        title={selected?.title ?? "My Roadmaps"}
        description="Open a field to see its goals, learning, projects, notes and proof together."
      />
      {!selected ? (
        <>
          <div className="entry-grid">
            {roadmaps.map((roadmap) => {
              const items = data.entries.filter((entry) =>
                (roadmap.categories as readonly string[]).includes(entry.category),
              );
              const progress = items.filter((entry) =>
                ["goal", "learning", "project"].includes(entry.kind),
              );
              return (
                <Section key={roadmap.slug} title={roadmap.title}>
                  <p className="muted">
                    {items.length} records ·{" "}
                    {items.filter((entry) => entry.status === "done").length} completed
                  </p>
                  <Progress
                    value={
                      progress.length
                        ? progress.reduce((sum, e) => sum + e.progress, 0) / progress.length
                        : 0
                    }
                  />
                  <Link className="text-link" href={`/${roadmap.slug}`}>
                    Open roadmap <ArrowUpRight size={15} />
                  </Link>
                </Section>
              );
            })}
          </div>
          <div className="feature-actions">
            <Link className="button secondary" href="/certificates">
              Certificates
            </Link>
            <Link className="button secondary" href="/progress">
              Progress Center
            </Link>
            <Link className="button secondary" href="/final-target-document">
              Printable target document
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="feature-actions">
            <Link className="text-link" href="/roadmaps">
              All roadmaps
            </Link>
            <Button onClick={() => edit({ kind: "note" })}>Add a note</Button>
            <Link className="button secondary" href="/document-vault">
              Upload proof
            </Link>
            <Link className="button secondary" href="/ai-assistant">
              Ask AI
            </Link>
          </div>
          <div className="feature-filters">
            <input
              aria-label="Search roadmap"
              placeholder="Search this roadmap…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              aria-label="Roadmap record type"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="all">All record types</option>
              {["goal", "learning", "project", "task", "habit", "note", "career"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="entry-grid">
            {entries.map((entry) => (
              <article className="card feature-card" key={entry.id}>
                <span className="badge">
                  {entry.kind} · {entry.status}
                </span>
                <h3>
                  <button
                    className="feature-title"
                    onClick={() => edit({ kind: entry.kind, entry })}
                  >
                    {entry.title}
                  </button>
                </h3>
                <p className="entry-notes long-notes">{entry.notes}</p>
                {["goal", "learning", "project"].includes(entry.kind) && (
                  <Progress value={entry.progress} label="Progress" />
                )}
                <Button className="secondary" onClick={() => edit({ kind: entry.kind, entry })}>
                  Open & edit
                </Button>
              </article>
            ))}
          </div>
          {!entries.length && (
            <p className="muted">No matching records. Add your first item or change the filters.</p>
          )}
        </>
      )}
    </>
  );
}

export function ProgressCenter({ certificatesOnly = false }: { certificatesOnly?: boolean }) {
  const { data, mutate, notify, edit } = useWorkspace();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [grouped, setGrouped] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const all = data.entries.filter((entry) =>
    certificatesOnly
      ? entry.kind === "learning" &&
        (entry.tags.includes("certificate") ||
          entry.details.resourceType?.toLowerCase().includes("certificate"))
      : ["project", "learning"].includes(entry.kind),
  );
  const filtered = all.filter(
    (entry) =>
      (!category || entry.category === category) &&
      (kind === "all" || entry.kind === kind) &&
      (status === "all" || entry.status === status) &&
      `${entry.title} ${entry.notes} ${entry.details.progressStage}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const groups = grouped
    ? Array.from(new Set(filtered.map((entry) => entry.category || "Uncategorized")))
    : ["All items"];
  async function update(entry: Entry, patch: Partial<Entry>) {
    setBusy(entry.id);
    setError("");
    try {
      await mutate(`/api/entries/${entry.id}`, "PATCH", patch);
      notify("Progress saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="Evidence of your progress"
        title={certificatesOnly ? "Certificates" : "Progress Center"}
        description="Track learning, certification and project stages across your original roadmap."
      />
      <div className="feature-actions">
        <Button onClick={() => edit({ kind: "learning" })}>Add learning / certificate</Button>
        <Link className="button secondary" href="/document-vault">
          Upload certificate proof
        </Link>
        <label className="check-label">
          <input
            type="checkbox"
            checked={grouped}
            onChange={(event) => setGrouped(event.target.checked)}
          />
          Group by field
        </label>
      </div>
      <div className="feature-filters">
        <input
          aria-label="Search progress"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search certificates and projects…"
        />
        <select
          aria-label="Progress category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">All categories</option>
          {Array.from(new Set(all.map((entry) => entry.category))).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Progress type"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="all">All types</option>
          <option value="learning">Learning / certificates</option>
          <option value="project">Projects</option>
        </select>
        <select
          aria-label="Progress status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">All statuses</option>
          {["planned", "active", "done", "archived"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <ErrorMessage error={error} />
      <p className="muted">
        {filtered.length} items · {all.filter((entry) => entry.status === "done").length} completed
      </p>
      {groups.map((group) => (
        <Section key={group} title={group}>
          <div className="progress-records">
            {filtered
              .filter((entry) => !grouped || (entry.category || "Uncategorized") === group)
              .map((entry) => (
                <div className="progress-record" key={entry.id}>
                  <button
                    className="feature-title"
                    onClick={() => edit({ kind: entry.kind, entry })}
                  >
                    {entry.title}
                    <small>
                      {entry.kind} · {entry.category}
                    </small>
                  </button>
                  <select
                    aria-label={`Stage for ${entry.title}`}
                    disabled={busy === entry.id}
                    value={
                      entry.details.progressStage ??
                      {
                        planned: "Not Started",
                        active: "In Progress",
                        done: "Completed",
                        archived: "Archived",
                      }[entry.status]
                    }
                    onChange={(event) =>
                      void update(entry, {
                        status: stageStatus(event.target.value),
                        progress: stageProgress[event.target.value] ?? entry.progress,
                        details: { ...entry.details, progressStage: event.target.value },
                      })
                    }
                  >
                    {progressStages.map((stage) => (
                      <option key={stage}>{stage}</option>
                    ))}
                  </select>
                  <div>
                    <input
                      type="number"
                      key={`${entry.id}/${entry.progress}`}
                      min={0}
                      max={100}
                      defaultValue={entry.progress}
                      aria-label={`Progress percentage for ${entry.title}`}
                      disabled={busy === entry.id}
                      onBlur={(event) => {
                        const value = Number(event.target.value);
                        if (
                          value !== entry.progress &&
                          Number.isInteger(value) &&
                          value >= 0 &&
                          value <= 100
                        )
                          void update(entry, {
                            progress: value,
                            status:
                              value === 100
                                ? "done"
                                : entry.status === "done"
                                  ? "active"
                                  : entry.status,
                            details: {
                              ...entry.details,
                              progressStage:
                                value === 100
                                  ? "Completed"
                                  : entry.details.progressStage === "Completed"
                                    ? "In Progress"
                                    : entry.details.progressStage,
                            },
                          });
                      }}
                    />
                    <Progress value={entry.progress} />
                  </div>
                </div>
              ))}
          </div>
        </Section>
      ))}
    </>
  );
}

export function MonthlyReview() {
  const { data, mutate, edit, notify } = useWorkspace();
  const [month, setMonth] = useState(today(data.user.timezone).slice(0, 7));
  const [score, setScore] = useState(7);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fields = [
    ["achievements", "What did I complete?"],
    ["challenges", "What did I fail to complete?"],
    ["improved", "Which skills improved?"],
    ["ignored", "Which field did I ignore?"],
    ["nextSteps", "Next month’s top three targets"],
    ["removeNext", "What should I remove next month?"],
  ] as const;
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await mutate("/api/entries", "POST", {
        kind: "journal",
        title: `Monthly review — ${month}`,
        category: "Monthly Review",
        tags: ["monthly-review"],
        period: "monthly",
        startDate: month + "-01",
        details: { reviewScore: score, ...draft },
      });
      setDraft({});
      notify("Monthly review saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const reviews = data.entries
    .filter(
      (entry) =>
        entry.kind === "journal" &&
        (entry.period === "monthly" || entry.tags.includes("monthly-review")),
    )
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
  return (
    <>
      <PageHeading
        eyebrow="Pause, notice, adjust"
        title="Monthly Review"
        description="Reflect on what worked and choose your next priorities."
      />
      <Section title="This month's reflection">
        <form className="settings-form" onSubmit={save}>
          <div className="feature-grid">
            <Field label="Review month">
              <input
                type="month"
                required
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </Field>
            <Field label="Month score / 10">
              <input
                type="number"
                min={1}
                max={10}
                required
                value={score}
                onChange={(event) => setScore(Number(event.target.value))}
              />
            </Field>
            {fields.map(([key, label]) => (
              <Field key={key} label={label}>
                <textarea
                  maxLength={20000}
                  value={draft[key] ?? ""}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                />
              </Field>
            ))}
          </div>
          <ErrorMessage error={error} />
          <Button type="submit" busy={busy}>
            <Save size={16} />
            Save monthly review
          </Button>
        </form>
      </Section>
      <div className="entry-grid">
        {reviews.map((review) => (
          <Section
            key={review.id}
            title={review.title}
            action={
              <button
                className="text-link"
                onClick={() => edit({ kind: "journal", entry: review })}
              >
                Edit
              </button>
            }
          >
            <span className="badge">{review.details.reviewScore ?? "—"}/10</span>
            {fields.map(([key, label]) => (
              <div key={key}>
                <strong>{label}</strong>
                <p className="entry-notes">
                  {String(review.details[key as keyof EntryDetails] ?? "—")}
                </p>
              </div>
            ))}
          </Section>
        ))}
      </div>
    </>
  );
}

export function TargetDocument() {
  const { data } = useWorkspace();
  const sections = [
    { title: "My identity", items: data.entries.filter((e) => e.title === "My future identity") },
    { title: "Targets", items: data.entries.filter((e) => e.kind === "goal") },
    { title: "Project plan", items: data.entries.filter((e) => e.kind === "project") },
    { title: "Annual roadmap", items: data.entries.filter((e) => e.kind === "event") },
    {
      title: "Routine and rules",
      items: data.entries.filter(
        (e) =>
          e.kind === "note" &&
          ["Routine", "Personal Direction", "Review Templates"].includes(e.category),
      ),
    },
    {
      title: "Country strategy",
      items: data.entries.filter((e) => e.category === "Country Strategy"),
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="A clear view of the bigger picture"
        title="Target Document"
        description="Your saved roadmap, organized into a document you can print or save as PDF."
      />
      <Button onClick={() => window.print()}>
        <Printer size={16} />
        Print / save PDF
      </Button>
      <article className="card section target-document">
        <h2 className="document-title">My life plan</h2>
        <p>{data.user.name}</p>
        {sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.items.map((entry) => (
              <div key={entry.id}>
                <h3>{entry.title}</h3>
                <p>{entry.notes}</p>
              </div>
            ))}
          </section>
        ))}
      </article>
    </>
  );
}

export function MotivationCard() {
  const { data } = useWorkspace();
  const quotes = data.entries
    .filter((entry) => entry.category === "Motivation")
    .flatMap((entry) => entry.notes.split(/\n\n/))
    .filter((quote) => quote.length > 20 && !quote.startsWith("Original plan:"));
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((value) => value + 1), 18000);
    return () => clearInterval(timer);
  }, []);
  if (!quotes.length) return null;
  return (
    <Section title="A little encouragement">
      <p className="motivation-copy">{quotes[index % quotes.length].replace(/^\d+\.\s*/, "")}</p>
      <button className="text-link" onClick={() => setIndex((value) => value + 1)}>
        Next thought
      </button>
    </Section>
  );
}
