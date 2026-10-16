import { Inject, Injectable } from "@nestjs/common";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import {
  DATABASE,
  Database,
  Executor,
  firstOrNull,
} from "@shared/database/database";

import {
  StoreAssetRow,
  StoreProjectRow,
  storeAssets,
  storeProjects,
} from "./store.tables";

@Injectable()
export class StoreRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async upsertProject(
    input: typeof storeProjects.$inferInsert,
  ): Promise<StoreProjectRow> {
    const [row] = await this.db
      .insert(storeProjects)
      .values(input)
      .onConflictDoUpdate({
        target: [storeProjects.workspaceId, storeProjects.slug],
        set: { name: input.name, languages: input.languages },
      })
      .returning();
    return row!;
  }

  async findProject(
    workspaceId: string,
    id: string,
  ): Promise<StoreProjectRow | null> {
    return firstOrNull(
      await this.db
        .select()
        .from(storeProjects)
        .where(
          and(
            eq(storeProjects.id, id),
            eq(storeProjects.workspaceId, workspaceId),
          ),
        )
        .limit(1),
    );
  }

  async findByTokenHash(hash: string): Promise<StoreProjectRow | null> {
    return firstOrNull(
      await this.db
        .select()
        .from(storeProjects)
        .where(eq(storeProjects.uploadTokenHash, hash))
        .limit(1),
    );
  }

  async listProjects(workspaceId: string, limit: number) {
    return this.db
      .select()
      .from(storeProjects)
      .where(eq(storeProjects.workspaceId, workspaceId))
      .orderBy(desc(storeProjects.updatedAt))
      .limit(limit);
  }

  async updateProject(
    id: string,
    values: Partial<typeof storeProjects.$inferInsert>,
    tx: Executor = this.db,
  ): Promise<StoreProjectRow> {
    const [row] = await tx
      .update(storeProjects)
      .set(values)
      .where(eq(storeProjects.id, id))
      .returning();
    return row!;
  }

  async deleteProject(id: string): Promise<void> {
    await this.db.delete(storeProjects).where(eq(storeProjects.id, id));
  }

  async assets(projectId: string): Promise<StoreAssetRow[]> {
    return this.db
      .select()
      .from(storeAssets)
      .where(eq(storeAssets.projectId, projectId))
      .orderBy(
        asc(storeAssets.kind),
        asc(storeAssets.style),
        asc(storeAssets.lang),
        asc(storeAssets.size),
        asc(storeAssets.name),
      );
  }

  async assetsByIds(
    projectId: string,
    ids: string[],
  ): Promise<StoreAssetRow[]> {
    if (!ids.length) return [];
    return this.db
      .select()
      .from(storeAssets)
      .where(
        and(eq(storeAssets.projectId, projectId), inArray(storeAssets.id, ids)),
      );
  }

  async countAssets(projectId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(storeAssets)
      .where(eq(storeAssets.projectId, projectId));
    return row?.n ?? 0;
  }

  async findVariant(
    tx: Executor,
    v: Pick<
      StoreAssetRow,
      "projectId" | "kind" | "name" | "style" | "lang" | "size"
    >,
  ): Promise<StoreAssetRow | null> {
    return firstOrNull(
      await tx
        .select()
        .from(storeAssets)
        .where(
          and(
            eq(storeAssets.projectId, v.projectId),
            eq(storeAssets.kind, v.kind),
            eq(storeAssets.name, v.name),
            eq(storeAssets.style, v.style),
            eq(storeAssets.lang, v.lang),
            eq(storeAssets.size, v.size),
          ),
        )
        .limit(1)
        .for("update"),
    );
  }

  async replaceAsset(
    tx: Executor,
    previous: StoreAssetRow | null,
    input: typeof storeAssets.$inferInsert,
  ): Promise<StoreAssetRow> {
    if (previous)
      await tx.delete(storeAssets).where(eq(storeAssets.id, previous.id));
    const [row] = await tx.insert(storeAssets).values(input).returning();
    return row!;
  }
}
