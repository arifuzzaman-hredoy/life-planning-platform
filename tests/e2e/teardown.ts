import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { db } from "../../src/lib/db";
import { hashToken } from "../../src/lib/password";

export default async function teardown() {
  if (!existsSync(".e2e/account.json")) return;
  const accounts = JSON.parse(readFileSync(".e2e/account.json", "utf8")) as {
    id: string;
    email: string;
  }[];
  try {
    for (const account of accounts) {
      if (!/^e2e-[0-9a-f]{20}@example\.test$/.test(account.email))
        throw new Error("Refusing unrecognized test identity");
      await db.user.deleteMany({ where: { id: account.id, email: account.email } });
      await db.loginAudit.deleteMany({ where: { emailHash: hashToken(account.email) } });
    }
    unlinkSync(".e2e/account.json");
  } finally {
    await db.$disconnect();
  }
}
