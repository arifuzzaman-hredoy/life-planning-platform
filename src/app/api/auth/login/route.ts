import { db } from "@/lib/db";
import { assertOrigin, createSession } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { failure, readJson, success } from "@/lib/http";
import { hashToken, verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validation";
import { publicUser } from "@/lib/serialize";

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const input = await readJson(request, loginSchema);
    const emailHash = hashToken(input.email);
    // The reverse proxy must overwrite X-Real-IP; untrusted forwarding chains are ignored.
    const ipHash = hashToken(
      process.env.TRUST_PROXY === "true"
        ? (request.headers.get("x-real-ip") ?? "unknown")
        : "direct",
    );
    const user = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"login:" + emailHash}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"ip:" + ipHash}))`;
      const since = new Date(Date.now() - 15 * 60 * 1000);
      const [accountAttempts, addressAttempts] = await Promise.all([
        tx.loginAudit.count({ where: { emailHash, successful: false, createdAt: { gte: since } } }),
        tx.loginAudit.count({ where: { ipHash, successful: false, createdAt: { gte: since } } }),
      ]);
      if (accountAttempts >= 10 || addressAttempts >= 40)
        throw new ApiError(429, "Too many sign-in attempts. Try again in 15 minutes.");
      const candidate = await tx.user.findUnique({ where: { email: input.email } });
      // A fixed-format dummy hash keeps missing-account verification comparable.
      const hash = candidate?.passwordHash ?? `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;
      const valid = await verifyPassword(input.password, hash);
      await tx.loginAudit.create({
        data: { emailHash, ipHash, successful: Boolean(candidate && valid) },
      });
      return candidate && valid ? candidate : null;
    });
    if (!user) throw new ApiError(401, "Email or password is incorrect");
    await createSession(user.id, user.passwordHash);
    return success({ user: publicUser(user) });
  } catch (error) {
    return failure(error);
  }
}
