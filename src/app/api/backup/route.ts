import { authenticated, readJson, success } from "@/lib/http";
import { backupSchema, exportWorkspace, restoreWorkspace } from "@/lib/backup";
export const GET = authenticated(
  async (_request, user) =>
    new Response(JSON.stringify(await exportWorkspace(user.id), null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=life-planning-backup.json",
        "Cache-Control": "no-store",
      },
    }),
);
export const POST = authenticated(async (request, user) => {
  const input = await readJson(request, backupSchema, 20 * 1024 * 1024);
  const commit = new URL(request.url).searchParams.get("commit") === "1";
  return success(await restoreWorkspace(user.id, input, !commit));
});
