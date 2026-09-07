"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="standalone-message">
      <span className="eyebrow">A brief interruption</span>
      <h1>We couldn’t open this page.</h1>
      <p>Your saved plans are still there. Please try again in a moment.</p>
      <div className="inline-actions">
        <button className="button" onClick={reset}>
          Try again
        </button>
        <Link href="/dashboard" className="button secondary">
          Go to overview
        </Link>
      </div>
    </div>
  );
}
