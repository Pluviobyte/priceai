import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "./client.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const handle = createDatabase(databaseUrl);

try {
  await migrate(handle.db, { migrationsFolder: "./drizzle" });
} finally {
  await handle.close();
}

