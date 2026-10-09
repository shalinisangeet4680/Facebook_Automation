import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import {
  createdAt,
  primaryId,
  updatedAt,
} from "../../../shared/database/columns";
import { users, workspaces } from "../../iam/infrastructure/iam.tables";

export const oauthClientKind = pgEnum("oauth_client_kind", ["dcr", "cimd"]);

export const oauthClients = pgTable("oauth_clients", {
  id: primaryId(),
  clientId: text("client_id").notNull().unique(),
  kind: oauthClientKind("kind").notNull(),
  name: text("name").notNull(),
  redirectUris: text("redirect_uris").array().notNull(),
  authMethod: text("auth_method").notNull().default("none"),
  secretHash: text("secret_hash"),
  clientUri: text("client_uri"),
  logoUri: text("logo_uri"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const oauthGrants = pgTable(
  "oauth_grants",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    scopes: text("scopes")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("oauth_grants_user_workspace_client_idx").on(
      t.userId,
      t.workspaceId,
      t.clientId,
    ),
    index("oauth_grants_workspace_idx").on(t.workspaceId),
  ],
);

export const oauthRefreshTokens = pgTable(
  "oauth_refresh_tokens",
  {
    id: primaryId(),
    grantId: uuid("grant_id")
      .notNull()
      .references(() => oauthGrants.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    replacedAt: timestamp("replaced_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("oauth_refresh_tokens_grant_idx").on(t.grantId)],
);

export type OAuthClientRow = typeof oauthClients.$inferSelect;
export type OAuthGrantRow = typeof oauthGrants.$inferSelect;
export type OAuthRefreshTokenRow = typeof oauthRefreshTokens.$inferSelect;
