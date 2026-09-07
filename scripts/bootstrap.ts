import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password";
import { loginSchema, passwordSchema } from "../src/lib/validation";
import { databaseConnectionString } from "../src/lib/database-url";

async function main() {
  const credentials = loginSchema.parse({
    email: process.env.OWNER_EMAIL,
    password: process.env.OWNER_PASSWORD,
  });
  passwordSchema.shape.newPassword.parse(credentials.password);
  const name = process.env.OWNER_NAME?.trim() || "My Workspace";
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseConnectionString() }),
  });
  try {
    const existing = await db.user.findUnique({
      where: { email: credentials.email },
      select: { id: true },
    });
    if (existing) {
      console.log("Owner account already exists; password was not changed.");
      return;
    }
    await db.user.create({
      data: {
        email: credentials.email,
        name,
        passwordHash: await hashPassword(credentials.password),
        mustChangePassword: true,
      },
    });
    console.log("Owner account created; initial password change is required.");
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    "Owner bootstrap failed. Check database availability and valid owner environment variables.",
  );
  process.exitCode = 1;
});
