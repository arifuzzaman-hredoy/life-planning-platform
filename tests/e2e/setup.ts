import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { db } from "../../src/lib/db";
import { hashPassword } from "../../src/lib/password";

export default async function setup() {
  if (process.env.RUN_E2E_TESTS !== "true")
    throw new Error("Set RUN_E2E_TESTS=true to create disposable, isolated E2E accounts.");
  if (existsSync(".e2e/account.json"))
    throw new Error(
      "A previous E2E fixture remains. Run its exact-account teardown before starting another run.",
    );
  mkdirSync(".e2e", { recursive: true });
  const accounts = [];
  try {
    for (const mustChangePassword of [false, true]) {
      const email = `e2e-${randomBytes(10).toString("hex")}@example.test`;
      const password = `Qa!${randomBytes(24).toString("base64url")}`;
      const user = await db.user.create({
        data: {
          email,
          name: "QA workspace",
          passwordHash: await hashPassword(password),
          mustChangePassword,
        },
      });
      accounts.push({ id: user.id, email, password, mustChangePassword });
      writeFileSync(".e2e/account.json", JSON.stringify(accounts), { mode: 0o600 });
    }
  } finally {
    await db.$disconnect();
  }
}
