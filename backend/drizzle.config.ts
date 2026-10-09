import { defineConfig } from "drizzle-kit";

process.loadEnvFile?.(".env");

export default defineConfig({
  schema: "./src/shared/database/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
