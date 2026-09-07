import { db } from "@/lib/db";
import { authenticated, readJson, success } from "@/lib/http";
import { profileSchema } from "@/lib/validation";
import { publicUser } from "@/lib/serialize";
export const PATCH = authenticated(
  async (request, user) =>
    success(
      publicUser(
        await db.user.update({
          where: { id: user.id },
          data: await readJson(request, profileSchema),
        }),
      ),
    ),
  true,
);
