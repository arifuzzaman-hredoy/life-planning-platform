export function databaseConnectionString(value = process.env.DATABASE_URL): string {
  if (!value) throw new Error("DATABASE_URL is required");
  const url = new URL(value);
  // Explicit certificate and hostname verification avoids ambiguous pg aliases.
  if (["require", "prefer", "verify-ca"].includes(url.searchParams.get("sslmode") ?? ""))
    url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

export function migrationConnectionString(value: string): string {
  const url = new URL(databaseConnectionString(value));
  // Session advisory locks used by Prisma Migrate need a direct Neon connection.
  if (url.hostname.endsWith(".neon.tech")) url.hostname = url.hostname.replace(/-pooler(?=\.)/, "");
  return url.toString();
}
