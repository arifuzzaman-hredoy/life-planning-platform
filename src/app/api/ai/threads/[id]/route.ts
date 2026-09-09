import { z } from "zod";
import { db } from "@/lib/db";
import { authenticated, readJson, success } from "@/lib/http";
import { ApiError } from "@/lib/errors";
export const GET = authenticated(async (_request, user, context) => {
  const { id } = await context.params;
  const thread = await db.chatThread.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      title: true,
      busyUntil: true,
      messages: { orderBy: { createdAt: "asc" }, include: { actions: true } },
    },
  });
  if (!thread) throw new ApiError(404, "Chat not found");
  return success(thread);
});
export const PATCH = authenticated(async (request, user, context) => {
  const { id } = await context.params;
  const input = await readJson(
    request,
    z
      .object({
        title: z.string().trim().min(1).max(100).optional(),
        clear: z.boolean().optional(),
      })
      .strict(),
  );
  return success(
    await db.$transaction(async (tx) => {
      const locked = await tx.chatThread.updateMany({
        where: {
          id,
          userId: user.id,
          OR: [{ busyUntil: null }, { busyUntil: { lt: new Date() } }],
        },
        data: { updatedAt: new Date(), ...(input.title ? { title: input.title } : {}) },
      });
      if (!locked.count) throw new ApiError(409, "Chat is unavailable or still replying");
      if (input.clear) await tx.chatMessage.deleteMany({ where: { threadId: id } });
      return { updated: true };
    }),
  );
});
export const DELETE = authenticated(async (_request, user, context) => {
  const { id } = await context.params;
  const result = await db.chatThread.deleteMany({
    where: { id, userId: user.id, OR: [{ busyUntil: null }, { busyUntil: { lt: new Date() } }] },
  });
  if (!result.count) throw new ApiError(409, "Chat is unavailable or still replying");
  return success({ deleted: true });
});
