import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, primaryId } from "../../../shared/database/columns";
import { users } from "../../iam/infrastructure/iam.tables";

export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: primaryId(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("otp_challenges_phone_created_idx").on(t.phone, t.createdAt)],
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").notNull(),
    familyId: uuid("family_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    replacedAt: timestamp("replaced_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [
    index("refresh_tokens_family_idx").on(t.familyId),
    index("refresh_tokens_user_idx").on(t.userId),
  ],
);

export type OtpChallengeRow = typeof otpChallenges.$inferSelect;
export type RefreshTokenRow = typeof refreshTokens.$inferSelect;
