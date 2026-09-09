import { db } from "@/lib/db";
import { authenticated, readJson, success } from "@/lib/http";
import { vaultPatchSchema } from "@/lib/feature-validation";
import { fileSelect } from "@/lib/vault";
import { ApiError } from "@/lib/errors";
export const PATCH = authenticated(async (request, user, context) => {
  const { id } = await context.params;
  return success(
    await db.vaultFile.update({
      where: { id, userId: user.id },
      data: await readJson(request, vaultPatchSchema),
      select: fileSelect,
    }),
  );
});
export const DELETE = authenticated(async (_request, user, context) => {
  const { id } = await context.params;
  const result = await db.vaultFile.deleteMany({ where: { id, userId: user.id } });
  if (!result.count) throw new ApiError(404, "File not found");
  return success({ deleted: true });
});
