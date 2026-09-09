import { z } from "zod";
import { authenticated, readJson, success } from "@/lib/http";
import { executeChatAction } from "@/lib/ai";
export const POST = authenticated(async (request, user, context) => {
  await readJson(request, z.object({}).strict());
  const { id } = await context.params;
  return success(await executeChatAction(user.id, id));
});
