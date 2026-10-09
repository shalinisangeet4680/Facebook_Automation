import { migrate } from "drizzle-orm/postgres-js/migrator";
import { join } from "path";

import { createDatabase, createSqlClient } from "./database";

async function run(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const client = createSqlClient(url, 1);
  await migrate(createDatabase(client), {
    migrationsFolder: join(__dirname, "../../../drizzle"),
  });
  await client.end();
}

void run().then(
  () => process.exit(0),
  (err: unknown) => {
    console.error(err);
    process.exit(1);
  },
);
