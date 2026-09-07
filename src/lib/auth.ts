import { cookies } from "next/headers";
import { db } from "./db";
import { ApiError } from "./errors";
import { hashToken, newSessionToken } from "./password";
export const SESSION_COOKIE = "life_planning_session";
const duration = 60 * 60 * 24 * 7;

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.user;
}
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Please sign in to continue");
  return user;
}
export async function createSession(userId: string, expectedPasswordHash: string) {
  const token = newSessionToken();
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"auth:" + userId}))`;
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    // A password reset between verification and session creation must not permit
    // the old password to establish a new authenticated session.
    if (!user || user.passwordHash !== expectedPasswordHash)
      throw new ApiError(401, "Credentials changed. Please sign in again.");
    await tx.session.deleteMany({ where: { userId, expiresAt: { lte: new Date() } } });
    await tx.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + duration * 1000),
      },
    });
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: duration,
  });
}
export async function revokeSession() {
  const cookieJar = await cookies();
  const token = cookieJar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  cookieJar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function assertOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.APP_URL || "http://localhost:3000").origin;
  if (!origin || origin !== expected) throw new ApiError(403, "Request origin is not allowed");
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.split(";")[0].trim().toLowerCase() !== "application/json")
    throw new ApiError(415, "Send application/json content");
}
