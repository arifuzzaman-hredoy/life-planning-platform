import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { authenticated, readJson, success } from "@/lib/http";
import { hashPassword, verifyPassword } from "@/lib/password";
import { passwordSchema } from "@/lib/validation";
export const POST = authenticated(async (request, user) => {
  const input = await readJson(request, passwordSchema);
  if (!(await verifyPassword(input.currentPassword, user.passwordHash)))
    throw new ApiError(400, "Current password is incorrect");
  if (input.currentPassword === input.newPassword)
    throw new ApiError(400, "Choose a different password");
  const passwordHash = await hashPassword(input.newPassword);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"auth:" + user.id}))`;
    const changed = await tx.user.updateMany({
      where: { id: user.id, passwordHash: user.passwordHash },
      data: { passwordHash, mustChangePassword: false },
    });
    if (!changed.count)
      throw new ApiError(409, "Your password changed in another session. Please sign in again.");
    await tx.session.deleteMany({ where: { userId: user.id } });
  });
  await createSession(user.id, passwordHash);
  return success({ changed: true });
}, true);
