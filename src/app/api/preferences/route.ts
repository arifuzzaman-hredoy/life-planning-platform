import { db } from "@/lib/db";
import { authenticated, readJson, success } from "@/lib/http";
import { preferencesSchema } from "@/lib/feature-validation";
export const GET = authenticated(async (_request, user) =>
  success(
    (await db.userPreferences.findUnique({
      where: { userId: user.id },
      select: { language: true, theme: true },
    })) ?? { language: "en", theme: "light" },
  ),
);
export const PUT = authenticated(async (request, user) => {
  const data = await readJson(request, preferencesSchema);
  return success(
    await db.userPreferences.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
      select: { language: true, theme: true },
    }),
  );
});
