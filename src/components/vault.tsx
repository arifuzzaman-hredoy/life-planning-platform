"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Download, Eye, FileText, Pencil, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/client";
import type { VaultData, VaultItem } from "@/lib/feature-contracts";
import { PageHeading } from "./entry-collection";
import { Button, ErrorMessage, Field, Modal, Section } from "./ui";
import { useWorkspace } from "./workspace";
const size = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + " MB";
export function Vault() {
  const { data, notify } = useWorkspace();
  const [vault, setVault] = useState<VaultData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("newest");
  const [subject, setSubject] = useState("");
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadType, setUploadType] = useState("document");
  const [uploadSubjects, setUploadSubjects] = useState("");
  const [editing, setEditing] = useState<VaultItem | null>(null);
  const [preview, setPreview] = useState<VaultItem | null>(null);
  const [textPreview, setTextPreview] = useState("");
  async function reload() {
    setVault(await api<VaultData>("/api/files"));
  }
  useEffect(() => {
    api<VaultData>("/api/files")
      .then(setVault)
      .catch((err) => setError(err.message));
  }, []);
  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name} exceeds the 25 MB limit.`);
        const form = new FormData();
        form.set("file", file);
        form.set("category", uploadCategory);
        form.set("fileType", uploadType);
        form.set(
          "subjects",
          JSON.stringify(
            uploadSubjects
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        );
        const response = await fetch("/api/files", { method: "POST", body: form });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Upload failed");
      }
      notify("Files uploaded to your private vault.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      await reload().catch(() => {});
      setBusy(false);
    }
  }
  async function show(file: VaultItem) {
    setPreview(file);
    setTextPreview("");
    if (file.mimeType === "text/plain")
      try {
        const response = await fetch(`/api/files/${file.id}/content`);
        if (!response.ok) throw new Error("Preview unavailable");
        setTextPreview((await response.text()).slice(0, 200000));
      } catch (err) {
        setError((err as Error).message);
      }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/files/${editing.id}`, "PATCH", {
        title: editing.title,
        description: editing.description,
        category: editing.category,
        fileType: editing.fileType,
        subjects: editing.subjects,
      });
      setEditing(null);
      await reload();
      notify("File details saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const categories = Array.from(
    new Set(
      [
        ...data.entries.map((entry) => entry.category),
        ...(vault?.files.map((file) => file.category) ?? []),
      ].filter(Boolean),
    ),
  ).sort();
  const types = Array.from(
    new Set([
      "certificate",
      "document",
      "code",
      "image",
      "other",
      ...(vault?.files.map((file) => file.fileType) ?? []),
    ]),
  );
  const files = (vault?.files ?? [])
    .filter(
      (file) =>
        (file.title + file.description + file.originalName + file.subjects.join(" "))
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!category || file.category === category) &&
        (!type || file.fileType === type) &&
        (!subject || file.subjects.includes(subject)),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title)
        : sort === "size"
          ? b.sizeBytes - a.sizeBytes
          : b.createdAt.localeCompare(a.createdAt),
    );
  return (
    <>
      <PageHeading
        eyebrow="Keep your evidence together"
        title="Document Vault"
        description="A private home for certificates, notes, screenshots, code and supporting documents."
      />
      <Section title="Upload files">
        <div className="feature-grid">
          <Field label="Category">
            <input
              list="vault-categories"
              value={uploadCategory}
              onChange={(event) => setUploadCategory(event.target.value)}
              placeholder="Choose or create a category"
            />
          </Field>
          <Field label="File type">
            <input
              list="vault-types"
              value={uploadType}
              onChange={(event) => setUploadType(event.target.value)}
            />
          </Field>
          <Field label="Subjects (comma separated)">
            <input
              value={uploadSubjects}
              onChange={(event) => setUploadSubjects(event.target.value)}
            />
          </Field>
        </div>
        <datalist id="vault-categories">
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </datalist>
        <datalist id="vault-types">
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </datalist>
        <div className="feature-actions">
          <label className="button">
            <Upload size={16} />
            {busy ? "Uploading…" : "Choose files"}
            <input
              type="file"
              multiple
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                void upload(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
          <span className="muted">
            25 MB per file · {size(vault?.usedBytes ?? 0)} of {size(vault?.maxBytes ?? 262144000)}
          </span>
        </div>
      </Section>
      <ErrorMessage error={error} />
      <div className="feature-filters">
        <input
          aria-label="Search vault"
          placeholder="Search your files…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="File category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="File type filter"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          aria-label="Subject filter"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        >
          <option value="">All subjects</option>
          {Array.from(new Set(vault?.files.flatMap((file) => file.subjects) ?? [])).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Sort files"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="name">Name</option>
          <option value="size">Largest first</option>
        </select>
      </div>
      <p className="muted">{files.length} files</p>
      <div className="entry-grid">
        {files.map((file) => (
          <article className="card feature-card" key={file.id}>
            <FileText size={22} />
            <span className="badge">{file.fileType}</span>
            <h3>{file.title}</h3>
            <p className="entry-notes">{file.description}</p>
            <p className="muted">
              {file.category || "Uncategorized"} · {size(file.sizeBytes)}
            </p>
            <div className="tags">
              {file.subjects.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <div className="feature-actions">
              <Button className="secondary" onClick={() => void show(file)}>
                <Eye size={15} />
                Preview
              </Button>
              <a
                className="icon-button"
                aria-label={`Download ${file.title}`}
                href={`/api/files/${file.id}/content?download=1`}
              >
                <Download size={17} />
              </a>
              <button
                className="icon-button"
                aria-label={`Edit file ${file.title}`}
                onClick={() => setEditing({ ...file })}
              >
                <Pencil size={17} />
              </button>
              <button
                className="icon-button"
                aria-label={`Delete file ${file.title}`}
                onClick={() => {
                  if (confirm(`Delete "${file.title}" and its uploaded file?`))
                    void api(`/api/files/${file.id}`, "DELETE")
                      .then(reload)
                      .catch((err) => setError(err.message));
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!files.length && (
        <div className="card section">
          <p className="muted">
            {vault?.files.length
              ? "No files match these filters."
              : "Upload your first file to start organizing your evidence."}
          </p>
        </div>
      )}
      {editing && (
        <Modal title="Edit file details" close={() => setEditing(null)}>
          <form className="modal-body settings-form" onSubmit={save}>
            <Field label="File title">
              <input
                required
                value={editing.title}
                onChange={(event) => setEditing({ ...editing, title: event.target.value })}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={editing.description}
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
              />
            </Field>
            <Field label="Category">
              <input
                list="vault-categories"
                value={editing.category}
                onChange={(event) => setEditing({ ...editing, category: event.target.value })}
              />
            </Field>
            <Field label="Type">
              <input
                list="vault-types"
                value={editing.fileType}
                onChange={(event) => setEditing({ ...editing, fileType: event.target.value })}
              />
            </Field>
            <Field label="Subjects">
              <input
                value={editing.subjects.join(",")}
                onChange={(event) =>
                  setEditing({ ...editing, subjects: event.target.value.split(",") })
                }
              />
            </Field>
            <ErrorMessage error={error} />
            <Button type="submit" busy={busy}>
              Save file details
            </Button>
          </form>
        </Modal>
      )}
      {preview && (
        <Modal title={preview.title} close={() => setPreview(null)} wide>
          <div className="modal-body">
            <p className="muted">
              {preview.originalName} · {size(preview.sizeBytes)}
            </p>
            {preview.mimeType.startsWith("image/") ? (
              <Image
                unoptimized
                width={1200}
                height={900}
                className="vault-image"
                src={`/api/files/${preview.id}/content`}
                alt={preview.title}
              />
            ) : preview.mimeType === "application/pdf" ? (
              <iframe
                className="vault-pdf"
                title={preview.title}
                src={`/api/files/${preview.id}/content`}
              />
            ) : preview.mimeType === "text/plain" ? (
              <pre className="vault-text">{textPreview || "Loading preview…"}</pre>
            ) : (
              <p>Download this file to open it with a compatible application.</p>
            )}
            <a className="button secondary" href={`/api/files/${preview.id}/content?download=1`}>
              <Download size={16} />
              Download original
            </a>
          </div>
        </Modal>
      )}
    </>
  );
}
