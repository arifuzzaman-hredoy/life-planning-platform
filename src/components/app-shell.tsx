"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Command,
  LogOut,
  Menu,
  Plus,
  Search,
  Sprout,
  X,
} from "lucide-react";
import { modules } from "@/lib/modules";
import { api, dateLabel, today, words } from "@/lib/client";
import { useWorkspace } from "./workspace";
import { Button, Modal } from "./ui";

export function AppShell({ children }: { children: ReactNode }) {
  const { data, edit, notify, syncError, refresh } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const current = modules.find((module) => pathname === `/${module.slug}`) ?? modules[0];
  const date = today(data.user.timezone);
  useEffect(() => {
    if (data.user.mustChangePassword && pathname !== "/settings") router.replace("/settings");
  }, [data.user.mustChangePassword, pathname, router]);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        if (!data.user.mustChangePassword) setSearchOpen(true);
      }
      if (event.key === "Escape") setMobile(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data.user.mustChangePassword]);
  async function logout() {
    setLoggingOut(true);
    try {
      await api("/api/auth/logout", "POST");
      router.push("/login");
      router.refresh();
    } catch (err) {
      notify((err as Error).message);
      setLoggingOut(false);
    }
  }
  const results = query.trim()
    ? data.entries
        .filter((item) =>
          `${item.title} ${item.notes} ${item.category} ${item.tags.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .slice(0, 25)
    : [];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "is-open" : ""}`} aria-label="Main navigation">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">
            <Sprout size={24} strokeWidth={1.8} />
          </span>
          <span>
            Life Planning<small>A little better, every day.</small>
          </span>
        </Link>
        <button
          className="icon-button mobile-close"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <div className="workspace-label">
          <span className="workspace-icon">{data.user.name.charAt(0).toUpperCase()}</span>
          <span>Personal workspace</span>
          <ChevronDown size={14} />
        </div>
        <nav>
          {Array.from(new Set(modules.map((module) => module.group))).map((group) => (
            <div key={group} className="nav-group">
              <p>{group}</p>
              {modules
                .filter((module) => module.group === group)
                .map(({ slug, label, icon: Icon }) => (
                  <Link
                    key={slug}
                    onClick={() => setMobile(false)}
                    href={data.user.mustChangePassword ? "/settings" : `/${slug}`}
                    className={`nav-link ${pathname === `/${slug}` ? "active" : ""}`}
                    aria-current={pathname === `/${slug}` ? "page" : undefined}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{label}</span>
                    {slug === "tasks" &&
                      data.entries.some(
                        (item) =>
                          item.kind === "task" &&
                          item.status !== "done" &&
                          item.status !== "archived",
                      ) && (
                        <span className="nav-count">
                          {
                            data.entries.filter(
                              (item) =>
                                item.kind === "task" &&
                                item.status !== "done" &&
                                item.status !== "archived",
                            ).length
                          }
                        </span>
                      )}
                  </Link>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar">{data.user.name.charAt(0).toUpperCase()}</div>
          <div>
            <strong>{data.user.name}</strong>
            <small>Your personal space</small>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            disabled={loggingOut}
            onClick={logout}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            <span>My workspace</span>
            <span className="slash">/</span>
            <strong>{current.label}</strong>
          </div>
          <div className="topbar-actions">
            <span className="top-date">
              {dateLabel(date, {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <button
              className="search-trigger"
              disabled={data.user.mustChangePassword}
              onClick={() => setSearchOpen(true)}
            >
              <Search size={17} />
              <span>Search anything</span>
              <kbd>
                <Command size={11} />K
              </kbd>
            </button>
            <Button disabled={data.user.mustChangePassword} onClick={() => edit({ kind: "task" })}>
              <Plus size={17} />
              <span className="quick-add-label">Quick add</span>
            </Button>
          </div>
        </header>
        <main id="main" className="main-content">
          {syncError && (
            <div className="sync-warning" role="alert">
              <p>
                Your last successful changes are saved, but this view could not refresh. {syncError}
              </p>
              <Button className="secondary" onClick={() => void refresh().catch(() => undefined)}>
                Refresh workspace
              </Button>
            </div>
          )}
          {data.user.mustChangePassword && pathname !== "/settings" ? (
            <div className="card section">
              <h1>Secure your account</h1>
              <p>Please set your own password before using your workspace.</p>
              <Link className="button" href="/settings">
                Change password <ArrowUpRight size={17} />
              </Link>
            </div>
          ) : (
            children
          )}
        </main>
        <footer className="app-footer">
          <span>Life Planning</span>
          <span>Your plans, one step at a time.</span>
        </footer>
      </div>
      {searchOpen && (
        <Modal title="Search your workspace" close={() => setSearchOpen(false)}>
          <div className="modal-body">
            <label className="search-field">
              <Search size={18} />
              <input
                autoFocus
                aria-label="Search titles, notes, categories and tags"
                placeholder="Search titles, notes, categories, tags…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="search-results">
              {!query.trim() ? (
                <p className="muted">Find a goal, a note, or your next task.</p>
              ) : results.length ? (
                results.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSearchOpen(false);
                      edit({ kind: item.kind, entry: item });
                    }}
                  >
                    <span className="badge">{words(item.kind)}</span>
                    <strong>{item.title}</strong>
                    <ArrowUpRight size={17} />
                  </button>
                ))
              ) : (
                <p className="muted">No matching items. Try a different word.</p>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
