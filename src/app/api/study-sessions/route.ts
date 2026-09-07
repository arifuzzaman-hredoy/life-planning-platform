import { authenticated, readJson, success } from "@/lib/http";
import { studySessionSchema } from "@/lib/validation";
import { serializeRecord } from "@/lib/serialize";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { todayInTimezone } from "@/lib/dates";
export const POST = authenticated(async (request, user) => {
  const input = await readJson(request, studySessionSchema);
  if (input.date > todayInTimezone(user.timezone))
    throw new ApiError(400, "Study sessions cannot be in the future");
  const entry = await db.entry.findFirst({
    where: { id: input.entryId, userId: user.id, kind: "learning" },
  });
  if (!entry) throw new ApiError(404, "Learning item not found");
  return success(
    serializeRecord(await db.studySession.create({ data: { ...input, userId: user.id } })),
    201,
  );
});
