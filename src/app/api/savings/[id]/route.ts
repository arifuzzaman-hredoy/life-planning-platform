import { authenticated, readJson, success } from "@/lib/http";
import { savingPatchSchema } from "@/lib/validation";
import { serializeRecord } from "@/lib/serialize";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
export const PATCH = authenticated(async (request, user, context) =>
  success(
    serializeRecord(
      await db.savingGoal.update({
        where: { id: (await context.params).id, userId: user.id },
        data: await readJson(request, savingPatchSchema),
      }),
    ),
  ),
);
export const DELETE = authenticated(async (_request, user, context) => {
  const deleted = await db.savingGoal.deleteMany({
    where: { id: (await context.params).id, userId: user.id },
  });
  if (!deleted.count) throw new ApiError(404, "Savings goal not found");
  return success({ deleted: true });
});
