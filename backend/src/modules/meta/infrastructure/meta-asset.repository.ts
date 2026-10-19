import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";

import { DATABASE, Database, Executor } from "@shared/database/database";

import { DiscoveredAsset } from "../domain/meta.types";
import { MetaAssetKind, MetaAssetRow, metaAssets } from "./meta.tables";

@Injectable()
export class MetaAssetRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  list(workspaceId: string, tx: Executor = this.db): Promise<MetaAssetRow[]> {
    return tx
      .select()
      .from(metaAssets)
      .where(eq(metaAssets.workspaceId, workspaceId))
      .orderBy(asc(metaAssets.kind), asc(metaAssets.name));
  }

  async sync(
    workspaceId: string,
    discovered: DiscoveredAsset[],
    tx: Executor = this.db,
  ): Promise<void> {
    for (const kind of [
      "business",
      "ad_account",
      "page",
      "instagram",
      "dataset",
    ] as MetaAssetKind[]) {
      const ids = discovered
        .filter((a) => a.kind === kind)
        .map((a) => a.externalId);
      await tx
        .delete(metaAssets)
        .where(
          and(
            eq(metaAssets.workspaceId, workspaceId),
            eq(metaAssets.kind, kind),
            ids.length ? notInArray(metaAssets.externalId, ids) : sql`true`,
          ),
        );
    }
    if (!discovered.length) return;
    await tx
      .insert(metaAssets)
      .values(discovered.map((a) => ({ ...a, workspaceId })))
      .onConflictDoUpdate({
        target: [
          metaAssets.workspaceId,
          metaAssets.kind,
          metaAssets.externalId,
        ],
        set: {
          name: sql`excluded.name`,
          data: sql`excluded.data`,
          updatedAt: new Date(),
        },
      });
  }

  async setPrimary(
    workspaceId: string,
    kind: MetaAssetKind,
    externalId: string,
    tx: Executor = this.db,
  ): Promise<boolean> {
    const target = await tx
      .select({ id: metaAssets.id })
      .from(metaAssets)
      .where(
        and(
          eq(metaAssets.workspaceId, workspaceId),
          eq(metaAssets.kind, kind),
          eq(metaAssets.externalId, externalId),
        ),
      )
      .limit(1);
    if (!target.length) return false;
    await tx
      .update(metaAssets)
      .set({ isPrimary: sql`${metaAssets.externalId} = ${externalId}` })
      .where(
        and(eq(metaAssets.workspaceId, workspaceId), eq(metaAssets.kind, kind)),
      );
    return true;
  }

  async clearPrimary(
    workspaceId: string,
    kind: MetaAssetKind,
    tx: Executor = this.db,
  ): Promise<void> {
    await tx
      .update(metaAssets)
      .set({ isPrimary: false })
      .where(
        and(eq(metaAssets.workspaceId, workspaceId), eq(metaAssets.kind, kind)),
      );
  }

  async autoSelectSingles(
    workspaceId: string,
    tx: Executor = this.db,
  ): Promise<void> {
    const rows = await this.list(workspaceId, tx);
    for (const kind of new Set(rows.map((r) => r.kind))) {
      const ofKind = rows.filter((r) => r.kind === kind);
      if (ofKind.length === 1 && !ofKind[0]!.isPrimary) {
        await tx
          .update(metaAssets)
          .set({ isPrimary: true })
          .where(inArray(metaAssets.id, [ofKind[0]!.id]));
      }
    }
  }

  async deleteAll(workspaceId: string, tx: Executor = this.db): Promise<void> {
    await tx.delete(metaAssets).where(eq(metaAssets.workspaceId, workspaceId));
  }
}
