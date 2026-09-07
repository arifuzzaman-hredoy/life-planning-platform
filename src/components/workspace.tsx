"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Entry, EntryKind, Workspace } from "@/lib/contracts";
import { api } from "@/lib/client";
import { EntryEditor } from "./entry-editor";
import { Button, ErrorMessage } from "./ui";

type EditorValue = {
  kind: EntryKind;
  entry?: Entry;
  parentId?: string;
  projectId?: string;
  goalId?: string;
};
type WorkspaceContextType = {
  data: Workspace;
  syncError: string;
  refresh: () => Promise<void>;
  edit: (value: EditorValue) => void;
  mutate: <T>(path: string, method?: string, body?: unknown) => Promise<T>;
  notify: (message: string) => void;
};
const Context = createContext<WorkspaceContextType | null>(null);
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Workspace is unavailable");
  return value;
}
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<EditorValue | null>(null);
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    try {
      const next = await api<Workspace>("/api/workspace");
      setData(next);
      setError("");
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, []);
  useEffect(() => {
    let active = true;
    api<Workspace>("/api/workspace")
      .then((next) => {
        if (active) {
          setData(next);
          setError("");
        }
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4200);
    return () => clearTimeout(timer);
  }, [notice]);
  const mutate = useCallback(
    async <T,>(path: string, method = "POST", body?: unknown) => {
      const result = await api<T>(path, method, body);
      try {
        await refresh();
      } catch {
        setNotice(
          "Your change was saved, but the workspace could not refresh. Reload the page to see it.",
        );
      }
      return result;
    },
    [refresh],
  );
  if (!data)
    return (
      <div className="workspace-pending">
        {error ? (
          <>
            <ErrorMessage error={error} />
            <Button onClick={() => void refresh().catch(() => undefined)}>Try again</Button>
          </>
        ) : (
          <>
            <div className="skeleton title-skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
            <p className="muted">Opening your workspace…</p>
          </>
        )}
      </div>
    );
  return (
    <Context.Provider
      value={{ data, syncError: error, refresh, edit: setEditor, mutate, notify: setNotice }}
    >
      {children}
      {editor && <EntryEditor {...editor} close={() => setEditor(null)} />}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button aria-label="Dismiss notification" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
