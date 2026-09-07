import { authenticated, readJson, success } from "@/lib/http";
import { habitLogSchema } from "@/lib/validation";
import { serializeRecord } from "@/lib/serialize";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { todayInTimezone } from "@/lib/dates";
export const POST = authenticated(async (request, user) => {
  const input = await readJson(request, habitLogSchema);
  if (input.date > todayInTimezone(user.timezone))
    throw new ApiError(400, "Habit check-ins cannot be in the future");
  const entry = await db.entry.findFirst({
    where: { id: input.entryId, userId: user.id, kind: "habit" },
  });
  if (!entry) throw new ApiError(404, "Habit not found");
  if (entry.startDate && input.date < entry.startDate)
    throw new ApiError(400, "Check-in cannot precede the habit start date");
  if (input.count === 0) {
    await db.habitLog.deleteMany({
      where: { entryId: input.entryId, userId: user.id, date: input.date },
    });
    return success({ deleted: true });
  }
  return success(
    serializeRecord(
      await db.habitLog.upsert({
        where: { entryId_date: { entryId: input.entryId, date: input.date } },
        create: { ...input, userId: user.id },
        update: { count: input.count },
      }),
    ),
  );
});
