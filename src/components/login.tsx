"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Sprout, Check, ShieldCheck } from "lucide-react";
import { api } from "@/lib/client";
import { Button, ErrorMessage, Field } from "./ui";
export function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", "POST", { email: email.trim(), password });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">
            <Sprout size={26} />
          </span>
          <span>
            Life Planning<small>A little better, every day.</small>
          </span>
        </div>
        <div className="login-story-content">
          <span className="eyebrow">YOUR LIFE, WITH INTENTION</span>
          <h1>
            Make space for
            <br />
            what matters.
          </h1>
          <p>
            Bring your goals, daily plans, and small wins together. Build a life that feels a little
            more like you.
          </p>
          <div className="login-preview">
            <div className="preview-heading">
              <span className="tiny-dot" />
              <strong>A day with direction</strong>
              <span>YOUR WORKSPACE</span>
            </div>
            <div>
              <span className="preview-check">
                <Check size={15} />
              </span>
              <span>Choose a meaningful priority</span>
            </div>
            <div>
              <span className="preview-check">
                <Check size={15} />
              </span>
              <span>Make time for a small habit</span>
            </div>
            <div>
              <span className="preview-check pending" />
              <span>Reflect, learn, and begin again</span>
            </div>
            <div className="preview-progress">
              <span />
            </div>
            <small>Progress starts with showing up.</small>
          </div>
        </div>
        <span className="login-story-footer">Small steps. A life well planned.</span>
        <div className="login-orbit" aria-hidden="true" />
      </section>
      <section className="login-form-side">
        <div className="login-form-wrap">
          <span className="login-mobile-brand">
            <Sprout size={23} />
            Life Planning
          </span>
          <span className="eyebrow">YOUR PERSONAL SPACE</span>
          <h2>Welcome back.</h2>
          <p className="login-description">Sign in and pick up where you left off.</p>
          <form onSubmit={signIn}>
            <Field label="Email address">
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                maxLength={254}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <span className="password-field">
                <input
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  maxLength={256}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={visible ? "Hide password" : "Show password"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </Field>
            <ErrorMessage error={error} />
            <Button type="submit" busy={busy} className="login-submit">
              Sign in to my workspace <ArrowRight size={17} />
            </Button>
          </form>
          <p className="login-help">
            This is a private workspace. Use the account credentials provided to you. If you need a
            password reset, contact the workspace owner.
          </p>
          <div className="login-security">
            <ShieldCheck size={16} />
            <span>Your plans are private to your account.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
