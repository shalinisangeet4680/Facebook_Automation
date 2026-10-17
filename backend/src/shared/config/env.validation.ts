import { z } from "zod";

const csv = z
  .string()
  .default("")
  .transform((v) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .refine(
      (v) => Buffer.from(v, "base64").length === 32,
      "must be 32 bytes, base64 encoded",
    ),
  OTP_TEST_NUMBERS: z.string().default(""),
  WEB_ORIGINS: csv,
  APP_URL: z
    .string()
    .url()
    .default("http://localhost:3200")
    .transform((v) => v.replace(/\/+$/, "")),
  COOKIE_DOMAIN: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  MEDIA_DIR: z.string().default("storage/media"),
  ADS_MAX_DAILY_BUDGET: z.coerce.number().positive().default(10_000),
  META_GRAPH_VERSION: z.string().default("v23.0"),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  META_MOCK: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  PLAY_MOCK: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  GBP_MOCK: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  AUTH_GOOGLE_MOCK: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  AUTH_GOOGLE_MOCK_EMAIL: z.string().default("owner@treevook.dev"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MOCK: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  AI_DAILY_DRAFTS: z.coerce.number().int().positive().default(300),
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}
