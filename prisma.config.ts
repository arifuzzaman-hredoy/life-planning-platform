import "dotenv/config";
import { defineConfig, env } from "prisma/config";
import { migrationConnectionString } from "./src/lib/database-url";

// Keep Prisma's migration history isolated from other applications too.
const databaseUrl = new URL(
  migrationConnectionString(process.env.DIRECT_DATABASE_URL || env("DATABASE_URL")),
);
databaseUrl.searchParams.set("schema", "life_planning");
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: databaseUrl.toString() },
});
