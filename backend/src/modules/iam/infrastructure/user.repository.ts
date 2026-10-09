import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

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
