import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await db.user.findFirst({ select: { id: true } });
    return NextResponse.json(
      { data: { status: "ready" } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Database is not ready" }, { status: 503 });
  }
}
