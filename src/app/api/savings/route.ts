import { authenticated, readJson, success } from "@/lib/http";
import { savingSchema } from "@/lib/validation";
import { serializeRecord } from "@/lib/serialize";
import { db } from "@/lib/db";
export const POST = authenticated(async (request, user) =>
  success(
    serializeRecord(
      await db.savingGoal.create({
        data: { ...(await readJson(request, savingSchema)), userId: user.id },
      }),
    ),
    201,
  ),
);
export const GET = authenticated(async (_request, user) =>
  success((await db.savingGoal.findMany({ where: { userId: user.id } })).map(serializeRecord)),
);
