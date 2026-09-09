import { authenticated, readJson, success } from "@/lib/http";
import { chatRequestSchema } from "@/lib/feature-validation";
import { sendChat } from "@/lib/ai";
export const maxDuration = 90;
export const POST = authenticated(async (request, user) =>
  success(await sendChat(user.id, await readJson(request, chatRequestSchema))),
);
