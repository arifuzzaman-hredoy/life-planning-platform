"use client";
import { useState } from "react";
import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { Button, ErrorMessage, Section } from "./ui";
import { PageHeading } from "./entry-collection";
import { useWorkspace } from "./workspace";
export function BackupRestore() {
  const { refresh, notify } = useWorkspace();
  const [contents, setContents] = useState("");
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function restore(commit = false) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/backup${commit ? "?commit=1" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: contents,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Restore failed");
      setReport(result.data);
      if (commit) {
        await refresh();
        notify("Missing backup records restored. Existing records were kept.");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="Keep a copy of what matters"
        title="Backup & Restore"
        description="Export your personal records and safely bring missing records back."
      />
      <div className="feature-columns">
        <Section title="Export your workspace">
          <p className="section-description">
            Includes plans, progress, habits, study logs, finance, daily plans, reviews and chat
            text. Passwords and AI keys are excluded. Download original uploaded files separately
            from the vault.
          </p>
          <a className="button" href="/api/backup" download="life-planning-backup.json">
            <Download size={16} />
            Download backup JSON
          </a>
          <p>
            <Link href="/document-vault" className="text-link">
              Open file vault
            </Link>
          </p>
        </Section>
        <Section title="Restore a backup">
          <p className="section-description">
            Choose a Life Planning backup JSON. Preview it first; restoring adds missing records and
            preserves existing changes.
          </p>
          <label className="button secondary">
            <Upload size={16} />
            Choose backup
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 20 * 1024 * 1024) {
                  setError("Backup must be at most 20 MB.");
                  return;
                }
                void file.text().then((text) => {
                  setContents(text);
                  setReport(null);
                  setError("");
                });
              }}
            />
          </label>
          <label className="field">
            <span>Or paste backup JSON</span>
            <textarea
              rows={7}
              value={contents}
              onChange={(event) => {
                setContents(event.target.value);
                setReport(null);
              }}
            />
          </label>
          <ErrorMessage error={error} />
          <div className="feature-actions">
            <Button busy={busy} disabled={!contents} onClick={() => void restore()}>
              Preview restore
            </Button>
            {report?.dryRun === true && (
              <Button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  if (confirm("Add missing records from this backup? Existing data will be kept."))
                    void restore(true);
                }}
              >
                Restore missing records
              </Button>
            )}
          </div>
          {report && <pre className="vault-text">{JSON.stringify(report, null, 2)}</pre>}
        </Section>
      </div>
    </>
  );
}
