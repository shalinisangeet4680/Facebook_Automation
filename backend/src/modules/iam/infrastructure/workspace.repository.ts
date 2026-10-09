import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";

import {
  DATABASE,
  Database,
  Executor,
  firstOrNull,
} from "@shared/database/database";

import { WorkspaceRole, workspaceMembers, workspaces } from "./iam.tables";

export interface MembershipView {
  workspaceId: string;
  name: string;
  role: WorkspaceRole;
}

@Injectable()
export class WorkspaceRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async createWithOwner(
    ownerId: string,
    name: string,
    tx: Executor = this.db,
  ): Promise<MembershipView> {
    const [workspace] = await tx
      .insert(workspaces)
      .values({ name, ownerId })
      .returning();
    await tx
      .insert(workspaceMembers)
      .values({ workspaceId: workspace!.id, userId: ownerId, role: "owner" });
    return { workspaceId: workspace!.id, name: workspace!.name, role: "owner" };
  }

  async firstMembership(
    userId: string,
    tx: Executor = this.db,
  ): Promise<MembershipView | null> {
    return firstOrNull(
      await tx
        .select({
          workspaceId: workspaces.id,
          name: workspaces.name,
          role: workspaceMembers.role,
        })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(eq(workspaceMembers.userId, userId))
        .orderBy(asc(workspaceMembers.createdAt))
        .limit(1),
    );
  }

  async membership(
    userId: string,
    workspaceId: string,
    tx: Executor = this.db,
  ): Promise<MembershipView | null> {
    return firstOrNull(
      await tx
        .select({
          workspaceId: workspaces.id,
          name: workspaces.name,
          role: workspaceMembers.role,
        })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(
          and(
            eq(workspaceMembers.userId, userId),
            eq(workspaceMembers.workspaceId, workspaceId),
          ),
        )
        .limit(1),
    );
  }
}
