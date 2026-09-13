import { z } from "zod";
import { db } from "@/lib/db";
import { authenticated, readJson, success } from "@/lib/http";
import { ApiError } from "@/lib/errors";
export const GET = authenticated(async (_request, user) =>
  success(
    await db.chatThread.findMany({
      where: { userId: user.id },
      select: { id: true, title: true, updatedAt: true, createdAt: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ),
);
export const POST = authenticated(async (request, user) => {
  await readJson(request, z.object({}).strict());
  const thread = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"chat-threads:" + user.id}))`;
    if ((await tx.chatThread.count({ where: { userId: user.id } })) >= 100)
      throw new ApiError(409, "You have 100 chats. Delete an old chat to start another.");
    return tx.chatThread.create({
      data: { userId: user.id },
      select: { id: true, title: true, updatedAt: true, createdAt: true },
    });
  });
  return success(thread, 201);
});
