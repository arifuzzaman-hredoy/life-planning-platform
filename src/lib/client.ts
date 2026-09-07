import type { ApiResponse } from "./contracts";

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = (await response.json().catch(() => ({
    error: "The server could not process this request. Please try again.",
  }))) as ApiResponse<T>;
  if (!response.ok || "error" in result)
    throw new Error("error" in result ? result.error : "Something went wrong.");
  return result.data;
}
export function today(timezone = "Asia/Dhaka") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function dateLabel(value: string | null, options?: Intl.DateTimeFormatOptions) {
  return value
    ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(
        "en-GB",
        options ?? { day: "numeric", month: "short" },
      )
    : "No date";
}
export function addDays(date: string, amount: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function money(amount: number, currency = "BDT") {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
export function words(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (s) => s.toUpperCase());
}
