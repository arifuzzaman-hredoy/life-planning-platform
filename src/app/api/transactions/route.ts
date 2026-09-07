import { authenticated, readJson, success } from "@/lib/http";
import { transactionSchema } from "@/lib/validation";
import { serializeRecord } from "@/lib/serialize";
import { db } from "@/lib/db";
export const POST = authenticated(async (request, user) =>
  success(
    serializeRecord(
      await db.transaction.create({
        data: { ...(await readJson(request, transactionSchema)), userId: user.id },
      }),
    ),
    201,
  ),
);
export const GET = authenticated(async (_request, user) =>
  success(
    (await db.transaction.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } })).map(
      serializeRecord,
    ),
  ),
);
