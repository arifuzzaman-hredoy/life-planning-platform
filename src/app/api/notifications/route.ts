import { z } from "zod";
import { db } from "@/lib/db";
import { authenticated, readJson, success } from "@/lib/http";
export const PATCH = authenticated(async (request, user) => {
  const { id } = await readJson(
    request,
    z.object({ id: z.string().min(1).max(100).optional() }).strict(),
  );
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null, ...(id ? { id } : {}) },
    data: { readAt: new Date() },
  });
  return success({ read: true });
});
