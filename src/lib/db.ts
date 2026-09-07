import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseConnectionString } from "./database-url";

const globalDb = globalThis as unknown as { lifePlanningDb?: PrismaClient };
export const db =
  globalDb.lifePlanningDb ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseConnectionString(),
      connectionTimeoutMillis: 10000,
      max: 10,
    }),
    transactionOptions: { maxWait: 10000, timeout: 20000 },
    // HTTP handlers emit sanitized structured failures; avoid logging query values.
    log: [],
  });
if (process.env.NODE_ENV !== "production") globalDb.lifePlanningDb = db;
