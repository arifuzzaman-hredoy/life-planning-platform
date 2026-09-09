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
  if ((await db.chatThread.count({ where: { userId: user.id } })) >= 100)
    throw new ApiError(409, "You have 100 chats. Delete an old chat to start another.");
  return success(
    await db.chatThread.create({
      data: { userId: user.id },
      select: { id: true, title: true, updatedAt: true, createdAt: true },
    }),
    201,
  );
});
