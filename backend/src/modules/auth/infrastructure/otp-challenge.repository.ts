import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";

import { DATABASE, Database, firstOrNull } from "@shared/database/database";

import { OtpChallengeRow, otpChallenges } from "./auth.tables";

@Injectable()
export class OtpChallengeRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(input: {
    phone: string;
    codeHash: string;
    expiresAt: Date;
    ip: string | null;
  }): Promise<OtpChallengeRow> {
    const [row] = await this.db.insert(otpChallenges).values(input).returning();
    return row!;
  }

  async latest(phone: string): Promise<OtpChallengeRow | null> {
    return firstOrNull(
      await this.db
        .select()
        .from(otpChallenges)
        .where(eq(otpChallenges.phone, phone))
        .orderBy(desc(otpChallenges.createdAt))
        .limit(1),
    );
  }

  async latestOpen(phone: string): Promise<OtpChallengeRow | null> {
    return firstOrNull(
      await this.db
        .select()
        .from(otpChallenges)
        .where(
          and(eq(otpChallenges.phone, phone), isNull(otpChallenges.consumedAt)),
        )
        .orderBy(desc(otpChallenges.createdAt))
        .limit(1),
    );
  }

  async countSince(phone: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(otpChallenges)
      .where(
        and(eq(otpChallenges.phone, phone), gt(otpChallenges.createdAt, since)),
      );
    return row?.n ?? 0;
  }

  async incrementAttempts(id: string): Promise<number> {
    const [row] = await this.db
      .update(otpChallenges)
      .set({ attempts: sql`${otpChallenges.attempts} + 1` })
      .where(eq(otpChallenges.id, id))
      .returning({ attempts: otpChallenges.attempts });
    return row?.attempts ?? 0;
  }

  async consume(id: string): Promise<boolean> {
    const rows = await this.db
      .update(otpChallenges)
      .set({ consumedAt: new Date() })
      .where(and(eq(otpChallenges.id, id), isNull(otpChallenges.consumedAt)))
      .returning({ id: otpChallenges.id });
    return rows.length === 1;
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const rows = await this.db
      .delete(otpChallenges)
      .where(lt(otpChallenges.createdAt, cutoff))
      .returning({ id: otpChallenges.id });
    return rows.length;
  }
}
