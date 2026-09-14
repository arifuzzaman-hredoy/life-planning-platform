import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import "./globals.css";
import "./features.css";

export const metadata: Metadata = {
  title: {
    default: "Life Planning — Your personal workspace",
    template: "%s · Life Planning",
  },
  description:
    "A calm, personal workspace for your goals, daily plans, habits, learning, and the life you are building.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#165c4f",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce-based CSP is generated per request by proxy.ts.
  // Waiting for the incoming request ensures the page is dynamically
  // rendered so Next.js can attach that nonce to its framework scripts.
  await connection();

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
