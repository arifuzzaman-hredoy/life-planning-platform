import { authenticated, readJson, success } from "@/lib/http";
import { entryPatchSchema } from "@/lib/validation";
import { updateEntry } from "@/lib/entries";
import { serializeRecord } from "@/lib/serialize";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
export const GET = authenticated(async (_request, user, context) => {
  const entry = await db.entry.findFirst({
    where: { id: (await context.params).id, userId: user.id },
  });
  if (!entry) throw new ApiError(404, "Entry not found");
  return success(serializeRecord(entry));
});
export const PATCH = authenticated(async (request, user, context) =>
  success(
    serializeRecord(
      await updateEntry(
        user.id,
        (await context.params).id,
        await readJson(request, entryPatchSchema),
        user.timezone,
      ),
    ),
  ),
);
export const DELETE = authenticated(async (_request, user, context) => {
  const deleted = await db.entry.deleteMany({
    where: { id: (await context.params).id, userId: user.id },
  });
  if (!deleted.count) throw new ApiError(404, "Entry not found");
  return success({ deleted: true });
});
