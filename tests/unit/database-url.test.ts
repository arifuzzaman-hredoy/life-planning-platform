import { describe, expect, it } from "vitest";
import { databaseConnectionString, migrationConnectionString } from "../../src/lib/database-url";

describe("database connection routing", () => {
  const pooled =
    "postgresql://example:example@ep-example-pooler.ap-southeast-1.aws.neon.tech/example?sslmode=require&schema=life_planning";

  it("keeps runtime traffic pooled while migration connections are direct", () => {
    expect(new URL(databaseConnectionString(pooled)).hostname).toContain("-pooler.");
    const migration = new URL(migrationConnectionString(pooled));
    expect(migration.hostname).toBe("ep-example.ap-southeast-1.aws.neon.tech");
    expect(migration.searchParams.get("sslmode")).toBe("verify-full");
    expect(migration.searchParams.get("schema")).toBe("life_planning");
    expect(migration.pathname).toBe("/example");
  });

  it("does not rewrite other providers or already-direct connections", () => {
    for (const host of [
      "127.0.0.1",
      "postgres-pooler.example.com",
      "ep-example.aws.neon.tech",
      "ep-example-pooler.neon.tech.example.com",
    ]) {
      const url = `postgresql://example:example@${host}:5432/example`;
      expect(new URL(migrationConnectionString(url)).hostname).toBe(host);
    }
  });
});
