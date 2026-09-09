import { db } from "@/lib/db";
import { authenticated, readJson, success } from "@/lib/http";
import { aiSettingsSchema } from "@/lib/feature-validation";
import { encryptSecret } from "@/lib/secrets";
export const GET = authenticated(async (_request, user) => {
  const setting = await db.aiSettings.findUnique({ where: { userId: user.id } });
  return success({
    configured: Boolean(setting?.keyCipher),
    model: setting?.model ?? "deepseek-v4-flash",
  });
});
export const PUT = authenticated(async (request, user) => {
  const input = await readJson(request, aiSettingsSchema);
  const keyCipher = input.removeKey
    ? ""
    : input.apiKey
      ? encryptSecret(input.apiKey, user.id)
      : undefined;
  const setting = await db.aiSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, model: input.model, keyCipher: keyCipher ?? "" },
    update: { model: input.model, ...(keyCipher !== undefined ? { keyCipher } : {}) },
  });
  return success({ configured: Boolean(setting.keyCipher), model: setting.model });
});
