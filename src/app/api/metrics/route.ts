import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { renderPrometheusMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request) {
  const expected = process.env.METRICS_TOKEN ?? "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (expected.length < 32 || Buffer.byteLength(expected) !== Buffer.byteLength(supplied))
    return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return new Response("Not found\n", {
      status: 404,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const started = performance.now();
  let databaseReady = false;
  try {
    await db.user.findFirst({ select: { id: true } });
    databaseReady = true;
  } catch {
    databaseReady = false;
  }

  const body = renderPrometheusMetrics({
    databaseReady,
    databaseCheckDurationSeconds: (performance.now() - started) / 1000,
    release: process.env.APP_RELEASE,
  });
  return new Response(body, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
