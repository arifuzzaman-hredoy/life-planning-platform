"use client";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  type ReactNode,
  type ReactElement,
} from "react";
import { X, Plus, LoaderCircle, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function Button({
  children,
  busy,
  className = "",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...props}
      type={type}
      disabled={props.disabled || busy}
      className={`button ${className}`}
    >
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function Empty({
  title,
  children,
  onAdd,
  action = "Add your first item",
}: {
  title: string;
  children: ReactNode;
  onAdd?: () => void;
  action?: string;
}) {
  return (
    <div className="empty">
      <div className="empty-symbol">
        <Plus size={23} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {onAdd && (
        <Button className="secondary" onClick={onAdd}>
          <Plus size={16} />
          {action}
        </Button>
      )}
    </div>
  );
}
export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div className="progress-wrap">
      {label && (
        <div className="progress-label">
          <span>{label}</span>
          <span>{Math.round(value)}%</span>
        </div>
      )}
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
      >
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
export function Section({
  title,
  children,
  href,
  action,
  className = "",
}: {
  title: string;
  children: ReactNode;
  href?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card section ${className}`}>
      <div className="section-heading">
        <h2>{title}</h2>
        {href && (
          <Link className="text-link" href={href}>
            View all <ArrowUpRight size={15} />
          </Link>
        )}
        {action}
      </div>
      {children}
    </section>
  );
}
export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            close();
        }
      }}
    >
      <header className="modal-heading">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" type="button" aria-label="Close dialog" onClick={close}>
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  wide?: boolean;
}) {
  const controls = Children.map(children, (child) => {
    if (
      isValidElement(child) &&
      typeof child.type === "string" &&
      ["input", "select", "textarea"].includes(child.type)
    ) {
      return cloneElement(child as ReactElement<{ "aria-label"?: string }>, {
        "aria-label": label,
      });
    }
    return child;
  });
  return (
    <label className={`field ${wide ? "full" : ""}`}>
      <span>{label}</span>
      {controls}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}
