import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { join } from "path";
import postgres from "postgres";

import { testDatabaseUrl } from "./test-database";

export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  if (!url) return;
  if (!process.env.CI) {
    const admin = new URL(url);
    const name = admin.pathname.slice(1);
    admin.pathname = "/postgres";
    const sql = postgres(admin.toString(), {
      max: 1,
      onnotice: () => undefined,
    });
    const exists = await sql`select 1 from pg_database where datname = ${name}`;
    if (!exists.length) await sql.unsafe(`create database "${name}"`);
    await sql.end();
  }
  const client = postgres(url, { max: 1, onnotice: () => undefined });
  await migrate(drizzle(client), {
    migrationsFolder: join(__dirname, "..", "drizzle"),
  });
  await client.end();
}
