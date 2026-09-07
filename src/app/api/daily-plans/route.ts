import { authenticated, readJson, success } from "@/lib/http";
import { dailyPlanSchema } from "@/lib/validation";
import { serializeRecord } from "@/lib/serialize";
import { db } from "@/lib/db";
export const PUT = authenticated(async (request, user) => {
  const input = await readJson(request, dailyPlanSchema);
  return success(
    serializeRecord(
      await db.dailyPlan.upsert({
        where: { userId_date: { userId: user.id, date: input.date } },
        create: { ...input, userId: user.id },
        update: input,
      }),
    ),
  );
});
