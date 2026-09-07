import { authenticated, readJson, success } from "@/lib/http";
import { entrySchema } from "@/lib/validation";
import { createEntry } from "@/lib/entries";
import { serializeRecord } from "@/lib/serialize";
import { db } from "@/lib/db";
export const GET = authenticated(async (_request, user) =>
  success(
    (await db.entry.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } })).map(
      serializeRecord,
    ),
  ),
);
export const POST = authenticated(async (request, user) =>
  success(serializeRecord(await createEntry(user.id, await readJson(request, entrySchema))), 201),
);
