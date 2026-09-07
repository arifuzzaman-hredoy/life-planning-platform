import Link from "next/link";
export default function NotFound() {
  return (
    <div className="standalone-message">
      <span className="eyebrow">404 · Page not found</span>
      <h1>Let’s get you back on track.</h1>
      <p>This page doesn’t exist. Your workspace is one step away.</p>
      <Link href="/dashboard" className="button">
        Open my workspace
      </Link>
    </div>
  );
}
