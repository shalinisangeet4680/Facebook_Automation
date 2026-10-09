import { existsSync, readFileSync } from "fs";
import { join } from "path";

export function testDatabaseUrl(): string | undefined {
  if (process.env.CI) return process.env.DATABASE_URL;
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const file = join(__dirname, "..", ".env");
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, "utf8")
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL="));
  if (!line) return undefined;
  const url = new URL(line.slice("DATABASE_URL=".length).trim());
  url.pathname = "/adpilot_test";
  return url.toString();
}
