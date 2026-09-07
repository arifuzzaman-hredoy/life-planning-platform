import { authenticated, readJson, success } from "@/lib/http";
import { transactionPatchSchema } from "@/lib/validation";
import { serializeRecord } from "@/lib/serialize";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
export const PATCH = authenticated(async (request, user, context) => {
  const id = (await context.params).id;
  const data = await readJson(request, transactionPatchSchema);
  return success(
    serializeRecord(await db.transaction.update({ where: { id, userId: user.id }, data })),
  );
});
export const DELETE = authenticated(async (_request, user, context) => {
  const deleted = await db.transaction.deleteMany({
    where: { id: (await context.params).id, userId: user.id },
  });
  if (!deleted.count) throw new ApiError(404, "Transaction not found");
  return success({ deleted: true });
});
