import "dotenv/config";
import { readFileSync, statSync } from "node:fs";
import { parseArgs } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { migrationConnectionString } from "../src/lib/database-url";
import { importPlan } from "./lib/plan-import";

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      owner: { type: "string" },
      commit: { type: "boolean", default: false },
    },
  });
  if (!values.file || !values.owner || !process.env.DATABASE_URL)
    throw new Error(
      "Usage: tsx scripts/import-plan.ts --file <private.json> --owner <email> [--commit]",
    );
  if (statSync(values.file).size > 20 * 1024 * 1024) throw new Error("Import file exceeds 20 MiB");
  const raw: unknown = JSON.parse(readFileSync(values.file, "utf8").replace(/^\uFEFF/, ""));
  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: migrationConnectionString(
        process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
      ),
      connectionTimeoutMillis: 15000,
      max: 2,
    }),
    log: [],
  });
  try {
    console.log(JSON.stringify(await importPlan(db, raw, values.owner, values.commit), null, 2));
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  // Do not log database URLs, query arguments, or private source content.
  console.error(
    "Import failed; no partial transaction was committed. Check the manifest, owner and database access.",
  );
  process.exitCode = 1;
});
