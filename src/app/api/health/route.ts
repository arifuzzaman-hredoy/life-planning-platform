import { success } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  return success({ status: "ok", service: "life-planning" });
}
