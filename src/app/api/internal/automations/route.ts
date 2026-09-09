import { timingSafeEqual } from "node:crypto";
import { runDueAutomations } from "@/lib/automation";
import { failure, success } from "@/lib/http";
export const maxDuration = 60;
export async function POST(request: Request) {
  const expected = process.env.APP_CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (
    !expected ||
    expected.length < 32 ||
    Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return success(await runDueAutomations());
  } catch (error) {
    return failure(error);
  }
}
