"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Copy, Maximize2, Paperclip, Plus, Send, Settings2, Trash2, X } from "lucide-react";
import { api } from "@/lib/client";
import { attachmentTextPreview } from "@/lib/chat-attachments";
import type { AiConfig, ChatDetail, ChatThreadView, VaultData } from "@/lib/feature-contracts";
import { Button, ErrorMessage, Field, Modal, Section } from "./ui";
import { PageHeading } from "./entry-collection";
import { useWorkspace } from "./workspace";

export function AiSettingsPanel() {
  const [config, setConfig] = useState<AiConfig>({ configured: false, model: "deepseek-v4-flash" });
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { notify } = useWorkspace();
  useEffect(() => {
    api<AiConfig>("/api/ai/settings")
      .then(setConfig)
      .catch((err) => setError(err.message));
  }, []);
  async function save(removeKey = false) {
    setBusy(true);
    setError("");
    try {
      setConfig(
        await api<AiConfig>("/api/ai/settings", "PUT", {
          model: config.model,
          ...(key ? { apiKey: key } : {}),
          removeKey,
        }),
      );
      setKey("");
      notify(removeKey ? "AI key removed." : "AI settings saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title="AI Settings">
      <p className="section-description">
        Connect your DeepSeek account. Messages and the context you select are sent to DeepSeek when
        you press Send. Your saved key stays encrypted on the server.
      </p>
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <p className="badge">{config.configured ? "API key connected" : "API key needed"}</p>
        <Field label="DeepSeek API key">
          <input
            type="password"
            autoComplete="new-password"
            maxLength={512}
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder={
              config.configured
                ? "Leave blank to keep your saved key"
                : "Paste your DeepSeek API key"
            }
          />
        </Field>
        <Field label="AI model">
          <select
            value={config.model}
            onChange={(event) => setConfig({ ...config, model: event.target.value })}
          >
            <option value="deepseek-v4-flash">DeepSeek V4 Flash</option>
            <option value="deepseek-v4-pro">DeepSeek V4 Pro</option>
          </select>
        </Field>
        <ErrorMessage error={error} />
        <div className="feature-actions">
          <Button type="submit" busy={busy}>
            Save AI settings
          </Button>
          {config.configured && (
            <Button
              className="secondary"
              disabled={busy}
              onClick={() => {
                if (confirm("Remove your saved DeepSeek key?")) void save(true);
              }}
            >
              Remove key
            </Button>
          )}
          <a
            href="https://platform.deepseek.com/api_keys"
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            Get an API key
          </a>
        </div>
      </form>
    </Section>
  );
}

const quickPrompts = [
  "আজ আমার পরিকল্পনা অনুযায়ী সবচেয়ে গুরুত্বপূর্ণ ৫টি কাজ কী?",
  "আমার লক্ষ্য ও progress দেখে দুর্বল জায়গাগুলো বলো।",
  "Cloud/DevOps portfolio-এর পরবর্তী project সাজেস্ট করো।",
  "আগামী ৭ দিনের পড়াশোনার পরিকল্পনা তৈরি করো।",
  "আমার certificate ও document gap-এর summary দাও।",
  "আমার weekly review-এর জন্য একটি note তৈরি করো।",
];
export function AiChat({ compact = false, onClose }: { compact?: boolean; onClose?: () => void }) {
  const { data, refresh, notify } = useWorkspace();
  const [threads, setThreads] = useState<ChatThreadView[]>([]);
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [vault, setVault] = useState<VaultData | null>(null);
  const [text, setText] = useState("");
  const [mode, setMode] = useState("general");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<
    { name: string; text: string; sizeBytes: number }[]
  >([]);
  const [saveUploads, setSaveUploads] = useState(true);
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const scroll = useRef<HTMLDivElement>(null);
  const loadThreads = useCallback(async () => {
    const result = await api<ChatThreadView[]>("/api/ai/threads");
    setThreads(result);
    return result;
  }, []);
  const open = useCallback(async (id: string) => {
    setChat(await api<ChatDetail>(`/api/ai/threads/${id}`));
    setError("");
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<ChatThreadView[]>("/api/ai/threads"),
      api<AiConfig>("/api/ai/settings"),
      api<VaultData>("/api/files"),
    ])
      .then(async ([list, cfg, files]) => {
        if (!active) return;
        setThreads(list);
        setConfig(cfg);
        setVault(files);
        if (list[0]) {
          const detail = await api<ChatDetail>(`/api/ai/threads/${list[0].id}`);
          if (active) setChat(detail);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "smooth" });
  }, [chat, busy]);
  async function newChat() {
    setError("");
    try {
      const result = await api<ChatThreadView>("/api/ai/threads", "POST", {});
      await loadThreads();
      await open(result.id);
      setText("");
      setSelected([]);
      setAttachments([]);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function clear(remove = false) {
    if (
      !chat ||
      !confirm(
        remove
          ? "Delete this conversation and its history?"
          : "Clear the messages in this conversation?",
      )
    )
      return;
    try {
      await api(
        `/api/ai/threads/${chat.id}`,
        remove ? "DELETE" : "PATCH",
        remove ? undefined : { clear: true },
      );
      if (remove) {
        setChat(null);
        await loadThreads();
      } else await open(chat.id);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function rename() {
    if (!chat) return;
    const title = prompt("Conversation title", chat.title)?.trim();
    if (!title) return;
    try {
      await api(`/api/ai/threads/${chat.id}`, "PATCH", { title: title.slice(0, 100) });
      await open(chat.id);
      await loadThreads();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    let id = chat?.id;
    try {
      if (!id) {
        const fresh = await api<ChatThreadView>("/api/ai/threads", "POST", {});
        id = fresh.id;
      }
      const result = await api<{ actionErrors: string[] }>("/api/ai/chat", "POST", {
        threadId: id,
        message: text,
        contextMode: mode,
        category,
        selectedFileIds: mode === "selected_files" ? selected : [],
        attachments: mode === "general" ? [] : attachments,
        autoExecute: auto,
      });
      setText("");
      setAttachments([]);
      await open(id);
      await loadThreads();
      if (auto) await refresh();
      if (result.actionErrors.length) setError(result.actionErrors.join(" "));
    } catch (err) {
      if (id) await open(id).catch(() => {});
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function attach(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    setError("");
    try {
      const next = [...attachments];
      const ids = [...selected];
      for (const file of Array.from(files).slice(0, 5 - next.length)) {
        if (file.size > 25 * 1024 * 1024) throw new Error("Each file must be at most 25 MB.");
        const readable =
          file.type.startsWith("text/") ||
          /\.(txt|md|json|html?|css|[cm]?js|tsx?|py|ya?ml|sql|tf|csv)$/i.test(file.name);
        next.push({
          name: file.name.slice(0, 200),
          text: readable
            ? await attachmentTextPreview(file)
            : "Binary attachment: metadata only; no text extraction.",
          sizeBytes: file.size,
        });
        if (saveUploads) {
          const form = new FormData();
          form.set("file", file);
          form.set("category", category);
          form.set("fileType", file.type.startsWith("image/") ? "image" : "document");
          const response = await fetch("/api/files", { method: "POST", body: form });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Upload failed");
          ids.push(result.data.id);
        }
      }
      setAttachments(next);
      setSelected([...new Set(ids)].slice(0, 12));
      setMode("selected_files");
      setVault(await api<VaultData>("/api/files"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const categories = Array.from(
    new Set(data.entries.map((e) => e.category).filter(Boolean)),
  ).sort();
  return (
    <div className={compact ? "chat-compact" : ""}>
      {!compact && (
        <PageHeading
          eyebrow="A thinking partner for your plans"
          title="AI Assistant"
          description="Talk through a goal, understand your notes, or turn ideas into a practical next step."
        />
      )}
      <div className="chat-top feature-actions">
        <Button className="secondary" onClick={() => void newChat()} disabled={busy}>
          <Plus size={15} />
          New chat
        </Button>
        <Button className="secondary" onClick={() => setSettings(true)}>
          <Settings2 size={15} />
          AI Settings
        </Button>
        {compact && (
          <>
            <Link
              href="/ai-assistant"
              onClick={onClose}
              className="icon-button"
              aria-label="Open full AI assistant"
            >
              <Maximize2 size={18} />
            </Link>
            <button className="icon-button" aria-label="Close AI assistant" onClick={onClose}>
              <X size={18} />
            </button>
          </>
        )}
      </div>
      {config && !config.configured && (
        <div className="feature-banner">
          Add your DeepSeek key in{" "}
          <button className="text-link" onClick={() => setSettings(true)}>
            AI Settings
          </button>{" "}
          to start chatting.
        </div>
      )}
      <div className="chat-layout">
        <aside className="card chat-history">
          <h2>Conversations</h2>
          {threads.length ? (
            threads.map((thread) => (
              <button
                key={thread.id}
                className={chat?.id === thread.id ? "selected" : ""}
                disabled={busy}
                onClick={() => void open(thread.id).catch((err) => setError(err.message))}
              >
                {thread.title}
              </button>
            ))
          ) : (
            <p className="muted">Your chats will appear here.</p>
          )}
        </aside>
        <section className="card chat-panel">
          <div className="chat-toolbar">
            <strong>{chat?.title ?? "Start a conversation"}</strong>
            {chat && (
              <div className="feature-actions">
                <button className="text-link" disabled={busy} onClick={() => void rename()}>
                  Rename
                </button>
                <button className="text-link" disabled={busy} onClick={() => void clear()}>
                  Clear
                </button>
                <button
                  className="icon-button"
                  aria-label="Delete conversation"
                  disabled={busy}
                  onClick={() => void clear(true)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
          <div className="chat-messages" ref={scroll} aria-live="polite">
            {!chat?.messages.length && (
              <div className="chat-welcome">
                <Bot size={34} />
                <h2>What would you like to work on?</h2>
                <p>Choose a context below to include your plans or files.</p>
                <div className="chat-prompts">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => {
                        setText(prompt);
                        setMode("everything");
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chat?.messages.map((message) => (
              <article className={`chat-message ${message.role}`} key={message.id}>
                <div className="chat-message-meta">
                  <strong>{message.role === "user" ? "You" : "AI Assistant"}</strong>
                  <button
                    className="icon-button"
                    aria-label="Copy message"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(message.content)
                        .then(() => notify("Message copied."))
                        .catch(() => setError("Copy was unavailable; select the text instead."))
                    }
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <p>{message.content}</p>
                {message.actions.map((action) => (
                  <div className="chat-action" key={action.id}>
                    <strong>
                      {action.type === "create_note" ? "Create note" : "Update file"}:{" "}
                      {action.payload.title ?? "File details"}
                    </strong>
                    <p>{action.payload.content ?? JSON.stringify(action.payload.changes)}</p>
                    {action.appliedAt ? (
                      <span className="badge">Applied</span>
                    ) : (
                      <Button
                        className="secondary"
                        disabled={busy}
                        onClick={() => {
                          setBusy(true);
                          api(`/api/ai/actions/${action.id}`, "POST", {})
                            .then(async () => {
                              await open(chat.id);
                              await refresh();
                            })
                            .catch((err) => setError(err.message))
                            .finally(() => setBusy(false));
                        }}
                      >
                        Apply suggestion
                      </Button>
                    )}
                  </div>
                ))}
              </article>
            ))}
            {busy && (
              <p role="status" className="muted">
                Working on your request…
              </p>
            )}
          </div>
          <form
            className="chat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <details className="chat-context">
              <summary>Context & attachments · {mode.replaceAll("_", " ")}</summary>
              <div className="feature-grid">
                <Field label="Context to share">
                  <select
                    value={mode}
                    onChange={(event) => {
                      setMode(event.target.value);
                      if (event.target.value === "general") {
                        setAttachments([]);
                        setSelected([]);
                      }
                    }}
                  >
                    <option value="general">General — no additional workspace data</option>
                    <option value="everything">Plans, notes & files</option>
                    <option value="current_field">Current field</option>
                    <option value="all_files">All file summaries</option>
                    <option value="selected_files">Selected files & attachments</option>
                  </select>
                </Field>
                <Field label="Field">
                  <select value={category} onChange={(event) => setCategory(event.target.value)}>
                    <option value="">Choose a field</option>
                    {categories.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <p className="muted">
                The recent messages in this conversation are included. Start a new chat for a fresh
                context. Text/code previews and file metadata can be shared. Images and PDFs are
                stored and previewed in the vault; their contents are not read by this text chat.
              </p>
              {mode === "selected_files" && (
                <div className="chat-file-picker">
                  <Field label="Search vault files">
                    <input
                      value={fileQuery}
                      onChange={(event) => setFileQuery(event.target.value)}
                    />
                  </Field>
                  {vault?.files
                    .filter((file) =>
                      (file.title + file.category).toLowerCase().includes(fileQuery.toLowerCase()),
                    )
                    .map((file) => (
                      <label className="check-label" key={file.id}>
                        <input
                          type="checkbox"
                          checked={selected.includes(file.id)}
                          onChange={(event) =>
                            setSelected(
                              event.target.checked
                                ? [...selected, file.id].slice(0, 12)
                                : selected.filter((id) => id !== file.id),
                            )
                          }
                        />
                        {file.title}
                      </label>
                    ))}
                </div>
              )}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={saveUploads}
                  onChange={(event) => setSaveUploads(event.target.checked)}
                />
                Save new attachments to my vault
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={auto}
                  onChange={(event) => setAuto(event.target.checked)}
                />
                Apply suggested note and file updates automatically
              </label>
            </details>
            {attachments.length > 0 && (
              <div className="feature-actions">
                {attachments.map((file, index) => (
                  <span className="badge" key={index}>
                    {file.name}
                    <button
                      type="button"
                      aria-label={`Remove attachment ${file.name}`}
                      onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <ErrorMessage error={error} />
            <label className="sr-only" htmlFor={compact ? "floating-prompt" : "chat-prompt"}>
              Message AI assistant
            </label>
            <textarea
              id={compact ? "floating-prompt" : "chat-prompt"}
              value={text}
              maxLength={12000}
              onChange={(event) => setText(event.target.value)}
              placeholder="Ask in Bangla or English…"
              rows={3}
            />
            <div className="chat-send">
              <label className="button secondary">
                <Paperclip size={16} />
                Attach files
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  disabled={busy}
                  onChange={(event) => {
                    void attach(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
              <Button type="submit" busy={busy} disabled={!text.trim() || !config?.configured}>
                <Send size={16} />
                Send
              </Button>
            </div>
          </form>
        </section>
      </div>
      {settings && (
        <Modal
          title="Connect your AI assistant"
          close={() => {
            setSettings(false);
            void api<AiConfig>("/api/ai/settings").then(setConfig);
          }}
        >
          <div className="modal-body">
            <AiSettingsPanel />
          </div>
        </Modal>
      )}
    </div>
  );
}

export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const { data } = useWorkspace();
  if (data.user.mustChangePassword) return null;
  return open ? (
    <div className="floating-chat" role="dialog" aria-label="AI assistant">
      <AiChat compact onClose={() => setOpen(false)} />
    </div>
  ) : (
    <button
      className="floating-ai-button"
      onClick={() => setOpen(true)}
      aria-label="Open AI assistant"
    >
      <Bot size={21} />
      <span>Ask AI</span>
    </button>
  );
}
