"use client";
import { useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  Pencil,
  Pin,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type { Entry, EntryKind } from "@/lib/contracts";
import { dateLabel, today, words } from "@/lib/client";
import { kindLabel } from "@/lib/modules";
import { translateLabel } from "@/lib/roadmaps";
import { useWorkspace } from "./workspace";
import { Button, Empty, ErrorMessage, Field, Modal, Progress } from "./ui";

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  const { data } = useWorkspace();
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{translateLabel(title, data.preferences?.language)}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function EntryRow({
  item,
  compact = false,
  child = false,
}: {
  item: Entry;
  compact?: boolean;
  child?: boolean;
}) {
  const { data, edit, mutate, notify } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const task = item.kind === "task" || child;
  async function complete() {
    setBusy(true);
    try {
      await mutate(`/api/entries/${item.id}`, "PATCH", {
        status: item.status === "done" ? "active" : "done",
        progress: item.status === "done" ? 0 : 100,
      });
      notify(item.status === "done" ? "Item reopened." : "Completed. A step forward!");
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={`entry-row ${item.status === "done" ? "is-done" : ""} ${child ? "child-row" : ""}`}
    >
      {task && (
        <button
          type="button"
          className={`check-button ${item.status === "done" ? "checked" : ""}`}
          disabled={busy}
          onClick={complete}
          aria-label={`${item.status === "done" ? "Reopen" : "Complete"} ${item.title}`}
        >
          {item.status === "done" && <Check size={14} />}
        </button>
      )}
      <button
        type="button"
        className="entry-main"
        onClick={() => edit({ kind: item.kind, entry: item })}
      >
        <strong>
          {item.pinned && <Pin size={13} />}
          {item.title}
        </strong>
        <span>
          {item.category || words(item.kind)}
          {item.targetDate && (
            <>
              {" "}
              ·{" "}
              <span
                className={
                  item.targetDate < today(data.user.timezone) && item.status !== "done"
                    ? "overdue"
                    : ""
                }
              >
                {dateLabel(item.targetDate)}
              </span>
            </>
          )}
          {item.details.recurrence && item.details.recurrence !== "none" && (
            <> · Repeats {item.details.recurrence}</>
          )}
        </span>
      </button>
      {!compact && (
        <span className={`badge priority-${item.priority}`}>{words(item.priority)}</span>
      )}
      {!task && <span className={`status-dot status-${item.status}`}>{words(item.status)}</span>}
      <button
        type="button"
        className="icon-button"
        aria-label={`Edit ${item.title}`}
        onClick={() => edit({ kind: item.kind, entry: item })}
      >
        <Pencil size={15} />
      </button>
    </div>
  );
}
export function Collection({
  kind,
  title,
  description,
}: {
  kind: EntryKind;
  title: string;
  description: string;
}) {
  const { data, edit, mutate, notify } = useWorkspace();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("open");
  const [category, setCategory] = useState("");
  const [period, setPeriod] = useState("");
  const [sort, setSort] = useState("updated");
  const [session, setSession] = useState<Entry | null>(null);
  const all = data.entries.filter((entry) => entry.kind === kind);
  const categories = Array.from(new Set(all.map((entry) => entry.category).filter(Boolean)));
  const entries = all
    .filter(
      (entry) =>
        (status === "all" ||
          (status === "open"
            ? !["done", "archived"].includes(entry.status)
            : entry.status === status)) &&
        (!category || entry.category === category) &&
        (!period || entry.period === period) &&
        `${entry.title} ${entry.notes} ${entry.tags.join(" ")} ${JSON.stringify(entry.details)}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        (sort === "date"
          ? (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999")
          : sort === "priority"
            ? ["urgent", "high", "medium", "low"].indexOf(a.priority) -
              ["urgent", "high", "medium", "low"].indexOf(b.priority)
            : b.updatedAt.localeCompare(a.updatedAt)),
    );
  async function patch(item: Entry, values: object) {
    try {
      await mutate(`/api/entries/${item.id}`, "PATCH", values);
    } catch (err) {
      notify((err as Error).message);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="Your personal workspace"
        title={title}
        description={description}
        action={
          <Button onClick={() => edit({ kind })}>
            <Plus size={17} />
            New {kindLabel(kind)}
          </Button>
        }
      />
      {kind === "journal" && (
        <div className="reflection-banner">
          <div>
            <span className="eyebrow">A moment to reflect</span>
            <h3>What is one thing you are grateful for today?</h3>
            <p>Capture what went well, what challenged you, and what comes next.</p>
          </div>
          <span className="reflection-glyph">“</span>
        </div>
      )}
      <div className="collection-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label={`Search ${title.toLowerCase()}`}
            placeholder={`Search ${title.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="open">Open items</option>
          <option value="all">All statuses</option>
          {["planned", "active", "done", "archived"].map((item) => (
            <option key={item} value={item}>
              {words(item)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        {kind === "goal" && (
          <select
            aria-label="Filter by planning period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="">All periods</option>
            {["daily", "weekly", "monthly", "yearly", "long_term"].map((item) => (
              <option key={item} value={item}>
                {words(item)}
              </option>
            ))}
          </select>
        )}
        <select aria-label="Sort items" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="updated">Recently updated</option>
          <option value="date">Target date</option>
          <option value="priority">Priority</option>
        </select>
      </div>
      <div className="collection-summary">
        <span>
          {entries.length} {entries.length === 1 ? "item" : "items"}
        </span>
        <span>
          {all.filter((entry) => entry.status === "done").length} completed ·{" "}
          {all.filter((entry) => entry.status === "archived").length} archived
        </span>
      </div>
      {entries.length === 0 ? (
        <div className="card">
          <Empty
            title={
              all.length ? "No items match these filters" : `Your ${title.toLowerCase()} start here`
            }
            onAdd={() => edit({ kind })}
            action={`Create a ${kindLabel(kind)}`}
          >
            {all.length
              ? "Try another search or choose all statuses to find completed and archived items."
              : `Add your first ${kindLabel(kind)}. Give it a clear name and a manageable next step.`}
          </Empty>
        </div>
      ) : kind === "task" ? (
        <div className="card task-list">
          {entries.map((entry) => (
            <div key={entry.id}>
              <EntryRow item={entry} child={Boolean(entry.parentId)} />
              {entry.parentId && (
                <p className="parent-hint">
                  Part of{" "}
                  {data.entries.find((item) => item.id === entry.parentId)?.title ??
                    "a linked plan"}
                </p>
              )}
              <div className="task-inline-actions">
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    edit({
                      kind: "task",
                      parentId: entry.id,
                      projectId: entry.projectId ?? undefined,
                      goalId: entry.goalId ?? undefined,
                    })
                  }
                >
                  <Plus size={13} />
                  Subtask
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`entry-grid ${kind === "note" || kind === "journal" ? "note-grid" : ""}`}>
          {entries.map((entry) => {
            const children = data.entries.filter(
              (item) =>
                item.parentId === entry.id ||
                item.projectId === entry.id ||
                item.goalId === entry.id,
            );
            const sessions = data.studySessions.filter((item) => item.entryId === entry.id);
            const links = [
              entry.url,
              entry.details.repositoryUrl,
              entry.details.liveUrl,
              ...(entry.details.resourceLinks ?? []),
            ].filter((url): url is string => Boolean(url));
            return (
              <article
                key={entry.id}
                className={`card entry-card ${kind === "event" ? "event-card" : ""}`}
              >
                <div className="entry-card-top">
                  <span className="badge">
                    {entry.category ||
                      (kind === "goal" || kind === "journal"
                        ? words(entry.period)
                        : words(
                            entry.details.resourceType ||
                              entry.details.stage ||
                              entry.details.eventType ||
                              entry.kind,
                          ))}
                  </span>
                  <div className="inline-actions">
                    {kind === "note" && (
                      <button
                        type="button"
                        className={`icon-button ${entry.pinned ? "pinned" : ""}`}
                        aria-label={`${entry.pinned ? "Unpin" : "Pin"} ${entry.title}`}
                        onClick={() => patch(entry, { pinned: !entry.pinned })}
                      >
                        <Pin size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Edit ${entry.title}`}
                      onClick={() => edit({ kind, entry })}
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                </div>
                <h3>
                  <button type="button" onClick={() => edit({ kind, entry })}>
                    {entry.title}
                  </button>
                </h3>
                {kind === "event" && (
                  <div className="event-date">
                    <CalendarDays size={20} />
                    <strong>
                      {dateLabel(entry.targetDate, {
                        weekday: "short",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </strong>
                    {entry.details.time && <span>{entry.details.time}</span>}
                  </div>
                )}
                {entry.notes && (
                  <p
                    className={`entry-notes ${kind === "note" || kind === "journal" ? "long-notes" : ""}`}
                  >
                    {entry.notes}
                  </p>
                )}
                {kind === "career" && (entry.details.company || entry.details.role) && (
                  <p className="muted">
                    {[entry.details.role, entry.details.company].filter(Boolean).join(" at ")}
                  </p>
                )}
                {kind === "career" && Boolean(entry.details.skills?.length) && (
                  <div className="tags">
                    {entry.details.skills?.filter(Boolean).map((skill, i) => (
                      <span key={`${skill}-${i}`}>{skill}</span>
                    ))}
                  </div>
                )}
                {kind === "journal" && (
                  <div className="journal-excerpts">
                    {(
                      [
                        ["achievements", "Wins"],
                        ["challenges", "Challenges"],
                        ["lessons", "Lessons"],
                        ["nextSteps", "Next steps"],
                      ] as const
                    ).map(
                      ([key, label]) =>
                        entry.details[key] && (
                          <div key={key}>
                            <strong>{label}</strong>
                            <p>{entry.details[key]}</p>
                          </div>
                        ),
                    )}
                  </div>
                )}
                {["goal", "project", "learning", "career"].includes(kind) && (
                  <Progress value={entry.progress} label="Progress" />
                )}
                {entry.tags.length > 0 && (
                  <div className="tags">
                    {entry.tags.map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </div>
                )}
                {links.length > 0 && (
                  <div className="resource-links">
                    {links.map((link, index) => (
                      <a
                        key={`${link}-${index}`}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink size={13} />
                        {new URL(link).hostname.replace(/^www\./, "")}
                      </a>
                    ))}
                  </div>
                )}
                {children.length > 0 && (
                  <div className="linked-items">
                    {children.map((child) => (
                      <EntryRow key={child.id} item={child} compact child />
                    ))}
                  </div>
                )}
                {["goal", "project"].includes(kind) && (
                  <button
                    type="button"
                    className="text-link child-add"
                    onClick={() =>
                      edit({
                        kind: "task",
                        parentId: entry.id,
                        ...(kind === "goal" ? { goalId: entry.id } : { projectId: entry.id }),
                      })
                    }
                  >
                    <Plus size={14} />
                    Add {kind === "goal" ? "milestone" : "task or milestone"}
                  </button>
                )}
                {kind === "learning" && (
                  <div className="study-actions">
                    <span>
                      <Clock3 size={15} />
                      {(sessions.reduce((sum, item) => sum + item.minutes, 0) / 60).toFixed(1)}h
                      studied · {sessions.length} sessions
                    </span>
                    <button type="button" className="text-link" onClick={() => setSession(entry)}>
                      Log study <Plus size={14} />
                    </button>
                  </div>
                )}
                <div className="entry-card-footer">
                  <span className={`status-dot status-${entry.status}`}>{words(entry.status)}</span>
                  <span>
                    {kind === "journal" ? (
                      dateLabel(entry.startDate)
                    ) : entry.targetDate ? (
                      <>
                        <CalendarDays size={13} />
                        {dateLabel(entry.targetDate)}
                      </>
                    ) : (
                      <span className={`priority-${entry.priority}`}>
                        {words(entry.priority)} priority
                      </span>
                    )}
                  </span>
                </div>
                {kind === "note" && (
                  <button
                    type="button"
                    className="text-link archive-link"
                    onClick={() =>
                      patch(entry, { status: entry.status === "archived" ? "active" : "archived" })
                    }
                  >
                    {entry.status === "archived" ? "Restore note" : "Archive note"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
      {session && <StudyEditor entry={session} close={() => setSession(null)} />}
    </>
  );
}
function StudyEditor({ entry, close }: { entry: Entry; close: () => void }) {
  const { data, mutate, notify } = useWorkspace();
  const [date, setDate] = useState(today(data.user.timezone));
  const [minutes, setMinutes] = useState(30);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await mutate("/api/study-sessions", "POST", { entryId: entry.id, date, minutes, notes });
      setNotes("");
      notify("Study session recorded.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await mutate(`/api/study-sessions/${id}`, "DELETE");
      setDeleteId(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <Modal title={`Study: ${entry.title}`} close={close}>
      <form onSubmit={save}>
        <div className="modal-body form-grid">
          <Field label="Date">
            <input
              type="date"
              required
              max={today(data.user.timezone)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Minutes studied">
            <input
              type="number"
              required
              min={1}
              max={1440}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </Field>
          <Field label="What did you practice?" wide>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={10000}
            />
          </Field>
          <div className="full">
            <ErrorMessage error={error} />
          </div>
        </div>
        <div className="modal-footer">
          <Button type="submit" busy={busy}>
            <Plus size={16} />
            Log session
          </Button>
        </div>
      </form>
      <div className="modal-body">
        <h3>Session history</h3>
        {data.studySessions.filter((item) => item.entryId === entry.id).length === 0 ? (
          <p className="muted">Your first session starts your learning history.</p>
        ) : (
          data.studySessions
            .filter((item) => item.entryId === entry.id)
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((item) => (
              <div key={item.id} className="session-row">
                <div>
                  <strong>{item.minutes} minutes</strong>
                  <span>
                    {dateLabel(item.date)}
                    {item.notes && ` · ${item.notes}`}
                  </span>
                </div>
                {deleteId === item.id ? (
                  <>
                    <Button className="danger" onClick={() => remove(item.id)}>
                      Confirm delete
                    </Button>
                    <Button className="ghost" onClick={() => setDeleteId(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="icon-button danger-text"
                    aria-label={`Delete study session on ${dateLabel(item.date)}`}
                    onClick={() => setDeleteId(item.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))
        )}
      </div>
    </Modal>
  );
}
