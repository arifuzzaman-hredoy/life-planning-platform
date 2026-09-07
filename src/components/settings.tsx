"use client";
import { useState } from "react";
import { Download, LockKeyhole, Save, ShieldCheck } from "lucide-react";
import { useWorkspace } from "./workspace";
import { PageHeading } from "./entry-collection";
import { Button, ErrorMessage, Field, Section } from "./ui";
import { today } from "@/lib/client";
export function Settings() {
  const { data, mutate, notify } = useWorkspace();
  const [name, setName] = useState(data.user.name);
  const [timezone, setTimezone] = useState(data.user.timezone);
  const [currency, setCurrency] = useState(data.user.currency);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  async function profile(event: React.FormEvent) {
    event.preventDefault();
    setProfileBusy(true);
    setProfileError("");
    try {
      await mutate("/api/profile", "PATCH", { name, timezone, currency });
      notify("Your preferences are saved.");
    } catch (err) {
      setProfileError((err as Error).message);
    } finally {
      setProfileBusy(false);
    }
  }
  async function password(event: React.FormEvent) {
    event.preventDefault();
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    try {
      await mutate("/api/auth/password", "POST", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      notify("Password changed. Your workspace is ready.");
    } catch (err) {
      setPasswordError((err as Error).message);
    } finally {
      setPasswordBusy(false);
    }
  }
  function exportData() {
    const blob = new Blob(
      [
        JSON.stringify(
          { exportedAt: new Date().toISOString(), formatVersion: 1, ...data },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `life-planning-${today(data.user.timezone)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Your workspace export is ready.");
  }
  return (
    <>
      <PageHeading
        eyebrow="Your workspace, your way"
        title="Settings"
        description="Update your preferences and keep your account secure."
      />
      {data.user.mustChangePassword && (
        <div className="security-banner" role="status">
          <ShieldCheck size={27} />
          <div>
            <h2>Make this workspace yours.</h2>
            <p>
              Set a new password below before you begin. Use your temporary login password as the
              current password.
            </p>
          </div>
        </div>
      )}
      <div className="settings-grid">
        <div>
          <Section title="Profile & preferences">
            <form onSubmit={profile} className="settings-form">
              <Field label="Your name">
                <input
                  required
                  maxLength={100}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Email address" hint="This is your sign-in address.">
                <input type="email" readOnly value={data.user.email} />
              </Field>
              <Field label="Timezone" hint="Used for today’s date, habits, and your daily plan.">
                <input
                  list="timezones"
                  required
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
                <datalist id="timezones">
                  {[
                    "Asia/Dhaka",
                    "Asia/Kolkata",
                    "Asia/Singapore",
                    "Asia/Dubai",
                    "Europe/London",
                    "America/New_York",
                    "America/Los_Angeles",
                    "UTC",
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </datalist>
              </Field>
              <Field label="Default currency" hint="Existing records keep their original currency.">
                <input
                  list="currencies"
                  required
                  minLength={3}
                  maxLength={3}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                />
                <datalist id="currencies">
                  {["BDT", "USD", "EUR", "GBP", "INR"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </datalist>
              </Field>
              <ErrorMessage error={profileError} />
              <Button type="submit" busy={profileBusy}>
                <Save size={16} />
                Save preferences
              </Button>
            </form>
          </Section>
          <Section title="Your data">
            <p className="section-description">
              Download your saved plans, notes, logs, and financial records as a JSON file. Keep the
              file somewhere private.
            </p>
            <Button className="secondary" onClick={exportData}>
              <Download size={16} />
              Export my workspace
            </Button>
            <p className="section-footnote">
              This is a personal data export. Restoring a server backup is handled separately by the
              workspace administrator.
            </p>
          </Section>
        </div>
        <Section title="Change password">
          <div className="settings-security-icon">
            <LockKeyhole size={25} />
          </div>
          <p className="section-description">
            Use at least 12 characters, including letters and a number or symbol. Changing your
            password signs out your other sessions.
          </p>
          <form onSubmit={password} className="settings-form">
            <input
              className="sr-only"
              autoComplete="username"
              value={data.user.email}
              readOnly
              aria-hidden="true"
              tabIndex={-1}
            />
            <Field label="Current password">
              <input
                type="password"
                required
                autoComplete="current-password"
                maxLength={256}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </Field>
            <Field label="New password">
              <input
                type="password"
                required
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>
            <Field label="Confirm new password">
              <input
                type="password"
                required
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
            <ErrorMessage error={passwordError} />
            <Button type="submit" busy={passwordBusy}>
              <ShieldCheck size={16} />
              Change password
            </Button>
          </form>
        </Section>
      </div>
    </>
  );
}
