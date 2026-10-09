import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DATABASE, Database, firstOrNull } from "@shared/database/database";

import { OAuthClientRow, oauthClients } from "./oauth.tables";

export type NewOAuthClient = Omit<
  typeof oauthClients.$inferInsert,
  "id" | "createdAt" | "updatedAt"
>;

@Injectable()
export class OAuthClientRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findByClientId(clientId: string): Promise<OAuthClientRow | null> {
    return firstOrNull(
      await this.db
        .select()
        .from(oauthClients)
        .where(eq(oauthClients.clientId, clientId))
        .limit(1),
    );
  }

  async insert(input: NewOAuthClient): Promise<OAuthClientRow> {
    const [row] = await this.db.insert(oauthClients).values(input).returning();
    return row!;
  }

  async upsert(input: NewOAuthClient): Promise<OAuthClientRow> {
    const [row] = await this.db
      .insert(oauthClients)
      .values(input)
      .onConflictDoUpdate({
        target: oauthClients.clientId,
        set: {
          name: input.name,
          redirectUris: input.redirectUris,
          authMethod: input.authMethod,
          clientUri: input.clientUri,
          logoUri: input.logoUri,
          fetchedAt: input.fetchedAt,
        },
      })
      .returning();
    return row!;
  }
}
