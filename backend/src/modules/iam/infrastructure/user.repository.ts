import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

import {
  DATABASE,
  Database,
  Executor,
  firstOrNull,
} from "@shared/database/database";

import { UserRow, users } from "./iam.tables";

@Injectable()
export class UserRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findById(id: string, tx: Executor = this.db): Promise<UserRow | null> {
    return firstOrNull(
      await tx.select().from(users).where(eq(users.id, id)).limit(1),
    );
  }

  async findByPhone(
    phone: string,
    tx: Executor = this.db,
  ): Promise<UserRow | null> {
    return firstOrNull(
      await tx.select().from(users).where(eq(users.phone, phone)).limit(1),
    );
  }

  async findByGoogleSub(
    sub: string,
    tx: Executor = this.db,
  ): Promise<UserRow | null> {
    return firstOrNull(
      await tx.select().from(users).where(eq(users.googleSub, sub)).limit(1),
    );
  }

  async findByEmail(
    email: string,
    tx: Executor = this.db,
  ): Promise<UserRow | null> {
    return firstOrNull(
      await tx
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
        .limit(1),
    );
  }

  async createFromGoogle(
    values: {
      googleSub: string;
      email: string;
      name: string | null;
      avatarUrl: string | null;
    },
    tx: Executor = this.db,
  ): Promise<UserRow> {
    const [row] = await tx.insert(users).values(values).returning();
    return row!;
  }

  async update(
    id: string,
    values: Partial<typeof users.$inferInsert>,
    tx: Executor = this.db,
  ): Promise<UserRow> {
    const [row] = await tx
      .update(users)
      .set(values)
      .where(eq(users.id, id))
      .returning();
    return row!;
  }

  async create(phone: string, tx: Executor = this.db): Promise<UserRow> {
    const [row] = await tx.insert(users).values({ phone }).returning();
    return row!;
  }

  async touchLogin(id: string, tx: Executor = this.db): Promise<void> {
    await tx
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }
}
