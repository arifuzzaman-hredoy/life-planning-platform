import { authenticated, readJson, success } from "@/lib/http";
import { budgetSchema } from "@/lib/validation";
import { serializeRecord } from "@/lib/serialize";
import { db } from "@/lib/db";
export const POST = authenticated(async (request, user) =>
  success(
    serializeRecord(
      await db.budget.create({
        data: { ...(await readJson(request, budgetSchema)), userId: user.id },
      }),
    ),
    201,
  ),
);
export const GET = authenticated(async (_request, user) =>
  success(
    (await db.budget.findMany({ where: { userId: user.id }, orderBy: { month: "desc" } })).map(
      serializeRecord,
    ),
  ),
);
