import { authenticated, success } from "@/lib/http";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
export const DELETE = authenticated(async (_request, user, context) => {
  const deleted = await db.studySession.deleteMany({
    where: { id: (await context.params).id, userId: user.id },
  });
  if (!deleted.count) throw new ApiError(404, "Study session not found");
  return success({ deleted: true });
});
