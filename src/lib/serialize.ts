import type { PublicUser } from "./contracts";
export function publicUser(user: PublicUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    timezone: user.timezone,
    currency: user.currency,
    mustChangePassword: user.mustChangePassword,
  };
}
export function serializeRecord<T extends Record<string, unknown>>(
  record: T,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (
      [
        "userId",
        "passwordHash",
        "tokenHash",
        "recurrenceSourceId",
        "recurrenceGeneratedAt",
      ].includes(key)
    )
      continue;
    if (value instanceof Date) result[key] = value.toISOString();
    else if (
      value &&
      typeof value === "object" &&
      "toNumber" in value &&
      typeof value.toNumber === "function"
    )
      result[key] = value.toNumber();
    else result[key] = value;
  }
  return result;
}
