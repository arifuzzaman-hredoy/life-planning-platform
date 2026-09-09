"use client";
import { useState } from "react";
import { Trash2, Save } from "lucide-react";
import {
  entryKinds,
  type Entry,
  type EntryInput,
  type EntryKind,
  type EntryDetails,
} from "@/lib/contracts";
import { kindLabel } from "@/lib/modules";
import { today, words } from "@/lib/client";
import { progressStages } from "@/lib/roadmaps";
import { useWorkspace } from "./workspace";
import { Button, ErrorMessage, Field, Modal } from "./ui";

export function EntryEditor({
  kind,
  entry,
  parentId,
  projectId,
  goalId,
  close,
}: {
  kind: EntryKind;
  entry?: Entry;
  parentId?: string;
  projectId?: string;
  goalId?: string;
  close: () => void;
}) {
  const { data, mutate, notify } = useWorkspace();
  const [form, setForm] = useState<EntryInput>(() =>
    entry
      ? { ...entry }
      : {
          kind,
          title: "",
          notes: "",
          category: "",
          tags: [],
          status: "planned",
          priority: "medium",
          progress: 0,
          startDate: kind === "journal" ? today(data.user.timezone) : null,
          targetDate: null,
          period: "daily",
          url: "",
          pinned: false,
          parentId: parentId ?? null,
          projectId: projectId ?? null,
          goalId: goalId ?? null,
          details:
            kind === "habit"
              ? { frequency: "daily", target: 1 }
              : kind === "task"
                ? { recurrence: "none" }
                : {},
        },
  );
  const [tags, setTags] = useState(form.tags.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  function set<K extends keyof EntryInput>(key: K, value: EntryInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  function detail<K extends keyof EntryDetails>(key: K, value: EntryDetails[K]) {
    setForm((prev) => ({ ...prev, details: { ...prev.details, [key]: value } }));
  }
  const options = (targetKind: EntryKind) =>
    data.entries.filter(
      (item) => item.kind === targetKind && item.id !== entry?.id && item.status !== "archived",
    );
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload: EntryInput = {
        ...form,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
      const { id: _id, createdAt: _created, updatedAt: _updated, ...clean } = payload as Entry;
      void _id;
      void _created;
      void _updated;
      await mutate(`/api/entries${entry ? `/${entry.id}` : ""}`, entry ? "PATCH" : "POST", clean);
      notify(`${words(kindLabel(form.kind))} ${entry ? "updated" : "created"}.`);
      close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await mutate(`/api/entries/${entry!.id}`, "DELETE");
      notify("Item deleted.");
      close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${entry ? "Edit" : "New"} ${kindLabel(form.kind)}`}
      close={busy ? () => undefined : close}
      wide
    >
      <form onSubmit={save}>
        <div className="modal-body form-grid">
          {!entry && (
            <Field label="Type">
              <select
                value={form.kind}
                onChange={(e) => {
                  set("kind", e.target.value as EntryKind);
                  set(
                    "details",
                    e.target.value === "habit" ? { frequency: "daily", target: 1 } : {},
                  );
                }}
              >
                {entryKinds.map((item) => (
                  <option key={item} value={item}>
                    {words(kindLabel(item))}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Title" wide>
            <input
              autoFocus
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={
                form.kind === "goal"
                  ? "What do you want to achieve?"
                  : form.kind === "journal"
                    ? "A few words about this reflection"
                    : "Give this a clear, helpful name"
              }
            />
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as EntryInput["status"])}
            >
              {["planned", "active", "done", "archived"].map((item) => (
                <option key={item} value={item}>
                  {words(item)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select
              value={form.priority}
              onChange={(e) => set("priority", e.target.value as EntryInput["priority"])}
            >
              {["low", "medium", "high", "urgent"].map((item) => (
                <option key={item} value={item}>
                  {words(item)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <input
              maxLength={80}
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="Health, personal, work…"
              list="entry-categories"
            />
            <datalist id="entry-categories">
              {Array.from(new Set(data.entries.map((item) => item.category).filter(Boolean))).map(
                (cat) => (
                  <option key={cat} value={cat} />
                ),
              )}
            </datalist>
          </Field>
          <Field label="Tags" hint="Separate tags with commas.">
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="devops, practice"
              maxLength={500}
            />
          </Field>
          <Field label={form.kind === "journal" ? "Reflection date" : "Start date"}>
            <input
              type="date"
              value={form.startDate ?? ""}
              onChange={(e) => set("startDate", e.target.value || null)}
            />
          </Field>
          <Field label={form.kind === "event" ? "Event date" : "Target date"}>
            <input
              type="date"
              value={form.targetDate ?? ""}
              onChange={(e) => set("targetDate", e.target.value || null)}
            />
          </Field>
          <Field label="Planning period">
            <select
              value={form.period}
              onChange={(e) => set("period", e.target.value as EntryInput["period"])}
            >
              {["daily", "weekly", "monthly", "yearly", "long_term"].map((item) => (
                <option key={item} value={item}>
                  {words(item)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Progress (%)">
            <input
              type="number"
              min={0}
              max={100}
              value={form.progress}
              onChange={(e) => set("progress", Number(e.target.value))}
            />
          </Field>
          {form.kind === "habit" && (
            <>
              <Field label="Frequency">
                <select
                  value={form.details.frequency ?? "daily"}
                  onChange={(e) => detail("frequency", e.target.value as "daily" | "weekly")}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </Field>
              <Field label="Target per period" hint="How many times per day or week?">
                <input
                  type="number"
                  min={1}
                  max={1000}
                  required
                  value={form.details.target ?? 1}
                  onChange={(e) => detail("target", Number(e.target.value))}
                />
              </Field>
            </>
          )}
          {form.kind === "task" && (
            <Field
              label="Repeat after completion"
              hint="Completing a repeating task creates its next occurrence."
            >
              <select
                value={form.details.recurrence ?? "none"}
                onChange={(e) => detail("recurrence", e.target.value as EntryDetails["recurrence"])}
              >
                {["none", "daily", "weekly", "monthly"].map((item) => (
                  <option key={item} value={item}>
                    {words(item)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {form.kind === "learning" && (
            <>
              <Field label="Resource type">
                <select
                  value={form.details.resourceType ?? "course"}
                  onChange={(e) => detail("resourceType", e.target.value)}
                >
                  {["course", "book", "technology", "topic", "practice", "certification"].map(
                    (item) => (
                      <option key={item} value={item}>
                        {words(item)}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="Topic / technology">
                <input
                  value={form.details.topic ?? ""}
                  onChange={(e) => detail("topic", e.target.value)}
                  maxLength={200}
                  placeholder="Kubernetes, Python…"
                />
              </Field>
              <Field label="Additional resource links" wide hint="One https:// link per line.">
                <textarea
                  rows={3}
                  value={(form.details.resourceLinks ?? []).join("\n")}
                  onChange={(e) => detail("resourceLinks", e.target.value.split("\n"))}
                />
              </Field>
            </>
          )}
          {form.kind === "career" && (
            <>
              <Field label="Company / organization">
                <input
                  maxLength={200}
                  value={form.details.company ?? ""}
                  onChange={(e) => detail("company", e.target.value)}
                />
              </Field>
              <Field label="Role / objective">
                <input
                  maxLength={200}
                  value={form.details.role ?? ""}
                  onChange={(e) => detail("role", e.target.value)}
                />
              </Field>
              <Field label="Career activity">
                <select
                  value={form.details.stage ?? "planning"}
                  onChange={(e) => detail("stage", e.target.value)}
                >
                  {[
                    "planning",
                    "skill_gap",
                    "certification",
                    "networking",
                    "preparing",
                    "applied",
                    "interview",
                    "offer",
                    "rejected",
                  ].map((item) => (
                    <option key={item} value={item}>
                      {words(item)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Skills to develop" hint="Separate with commas.">
                <input
                  maxLength={1000}
                  value={(form.details.skills ?? []).join(", ")}
                  onChange={(e) =>
                    detail(
                      "skills",
                      e.target.value.split(",").map((item) => item.trim()),
                    )
                  }
                />
              </Field>
            </>
          )}
          {["project", "learning"].includes(form.kind) && (
            <>
              <Field label="Detailed progress stage">
                <select
                  value={form.details.progressStage ?? ""}
                  onChange={(event) => detail("progressStage", event.target.value)}
                >
                  <option value="">Use status above</option>
                  {progressStages.map((stage) => (
                    <option key={stage}>{stage}</option>
                  ))}
                </select>
              </Field>
              <Field label="Target year">
                <input
                  maxLength={200}
                  value={form.details.targetYear ?? ""}
                  onChange={(event) => detail("targetYear", event.target.value)}
                  placeholder="For example, 2028 or Optional"
                />
              </Field>
            </>
          )}
          {form.kind === "learning" && (
            <details className="full">
              <summary>Certificate & personal skill details</summary>
              <div className="form-grid">
                {(
                  [
                    ["provider", "Provider"],
                    ["cost", "Cost"],
                    ["validity", "Validity"],
                    ["proofType", "Proof type"],
                    ["currentLevel", "Current level"],
                    ["habitTarget", "Habit target"],
                    ["nextAction", "Next action"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input
                      maxLength={200}
                      value={form.details[key] ?? ""}
                      onChange={(event) => detail(key, event.target.value)}
                    />
                  </Field>
                ))}
              </div>
            </details>
          )}
          {form.kind === "project" && (
            <details className="full">
              <summary>Project case study</summary>
              <div className="form-grid">
                <Field label="Tech stack">
                  <input
                    maxLength={200}
                    value={form.details.stack ?? ""}
                    onChange={(event) => detail("stack", event.target.value)}
                  />
                </Field>
                <Field label="Demo URL">
                  <input
                    type="url"
                    value={form.details.demoUrl ?? ""}
                    onChange={(event) => detail("demoUrl", event.target.value)}
                  />
                </Field>
                <Field label="Difficulty">
                  <input
                    maxLength={200}
                    value={form.details.difficulty ?? ""}
                    onChange={(event) => detail("difficulty", event.target.value)}
                  />
                </Field>
                {(
                  [
                    ["problem", "Problem"],
                    ["solution", "Solution"],
                    ["impact", "Impact / result"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label} wide>
                    <textarea
                      maxLength={20000}
                      value={form.details[key] ?? ""}
                      onChange={(event) => detail(key, event.target.value)}
                    />
                  </Field>
                ))}
              </div>
            </details>
          )}
          {form.kind === "journal" && (
            <details className="full">
              <summary>Monthly review details</summary>
              <div className="form-grid">
                <Field label="Review score / 10">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.details.reviewScore ?? ""}
                    onChange={(event) =>
                      detail(
                        "reviewScore",
                        event.target.value ? Number(event.target.value) : undefined,
                      )
                    }
                  />
                </Field>
                {(
                  [
                    ["improved", "Skills improved"],
                    ["ignored", "Fields ignored"],
                    ["removeNext", "Remove next month"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <textarea
                      maxLength={20000}
                      value={form.details[key] ?? ""}
                      onChange={(event) => detail(key, event.target.value)}
                    />
                  </Field>
                ))}
              </div>
            </details>
          )}
          {form.kind === "project" && (
            <>
              <Field label="Repository URL">
                <input
                  type="url"
                  value={form.details.repositoryUrl ?? ""}
                  onChange={(e) => detail("repositoryUrl", e.target.value)}
                  placeholder="https://github.com/…"
                />
              </Field>
              <Field label="Live project URL">
                <input
                  type="url"
                  value={form.details.liveUrl ?? ""}
                  onChange={(e) => detail("liveUrl", e.target.value)}
                  placeholder="https://…"
                />
              </Field>
            </>
          )}
          {form.kind === "event" && (
            <>
              <Field label="Event type">
                <select
                  value={form.details.eventType ?? "event"}
                  onChange={(e) => detail("eventType", e.target.value)}
                >
                  {[
                    "event",
                    "birthday",
                    "deadline",
                    "exam",
                    "appointment",
                    "career_milestone",
                    "reminder",
                  ].map((item) => (
                    <option key={item} value={item}>
                      {words(item)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Time (your timezone)">
                <input
                  type="time"
                  value={form.details.time ?? ""}
                  onChange={(e) => detail("time", e.target.value)}
                />
              </Field>
            </>
          )}
          <Field label={form.kind === "note" ? "Note content" : "Notes"} wide>
            <textarea
              rows={form.kind === "note" ? 8 : 3}
              maxLength={20000}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Add the details you will want to come back to…"
            />
          </Field>
          {form.kind === "journal" && (
            <>
              {(
                [
                  ["achievements", "What went well?"],
                  ["challenges", "What was difficult?"],
                  ["lessons", "What did you learn?"],
                  ["nextSteps", "What will you do next?"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <textarea
                    rows={3}
                    maxLength={10000}
                    value={form.details[key] ?? ""}
                    onChange={(e) => detail(key, e.target.value)}
                  />
                </Field>
              ))}
            </>
          )}
          <Field label="Reference URL" wide>
            <input
              type="url"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://…"
              maxLength={2000}
            />
          </Field>
          <details className="full form-disclosure">
            <summary>Connect this to your plans</summary>
            <div className="form-grid">
              <Field label="Related goal">
                <select
                  value={form.goalId ?? ""}
                  onChange={(e) => set("goalId", e.target.value || null)}
                >
                  <option value="">No linked goal</option>
                  {options("goal").map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Related project">
                <select
                  value={form.projectId ?? ""}
                  onChange={(e) => set("projectId", e.target.value || null)}
                >
                  <option value="">No linked project</option>
                  {options("project").map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Parent task / goal / project"
                wide
                hint="Use a parent to organize subtasks and milestones."
              >
                <select
                  value={form.parentId ?? ""}
                  onChange={(e) => set("parentId", e.target.value || null)}
                >
                  <option value="">No parent</option>
                  {data.entries
                    .filter(
                      (item) =>
                        ["task", "goal", "project"].includes(item.kind) && item.id !== entry?.id,
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {words(item.kind)} · {item.title}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
          </details>
          {form.kind === "note" && (
            <label className="checkbox-field full">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => set("pinned", e.target.checked)}
              />
              Pin this note
            </label>
          )}
          <div className="full">
            <ErrorMessage error={error} />
            {deleting && (
              <div className="delete-confirm">
                <p>
                  Delete “{entry?.title}”? This permanently deletes the item and its logs. Linked
                  items will be kept.
                </p>
                <Button type="button" className="danger" busy={busy} onClick={remove}>
                  Delete permanently
                </Button>
                <Button type="button" className="ghost" onClick={() => setDeleting(false)}>
                  Keep item
                </Button>
              </div>
            )}
          </div>
        </div>
        <footer className="modal-footer">
          {entry && (
            <Button
              type="button"
              className="ghost danger-text"
              disabled={busy}
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={16} />
              Delete
            </Button>
          )}
          <div className="spacer" />
          <Button type="button" className="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            <Save size={16} />
            {entry ? "Save changes" : "Create item"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
