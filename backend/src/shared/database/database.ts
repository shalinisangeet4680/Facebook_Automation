import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Transaction;

export const DATABASE = Symbol("DATABASE");
export const SQL_CLIENT = Symbol("SQL_CLIENT");

export function createSqlClient(url: string, max = 10) {
  return postgres(url, {
    max,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: true,
  });
}

export function createDatabase(client: ReturnType<typeof createSqlClient>) {
  return drizzle(client, { schema, casing: "snake_case" });
}

export function firstOrNull<T>(rows: T[]): T | null {
  return rows[0] ?? null;
}
