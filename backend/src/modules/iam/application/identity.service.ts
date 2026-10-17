import { Inject, Injectable } from "@nestjs/common";

import { DATABASE, Database } from "@shared/database/database";
import { NotFoundError } from "@shared/errors/domain-error";
import { TenantContext } from "@shared/tenant/tenant-context";

import {
  GoogleIdentity,
  MeView,
  SignInIdentity,
} from "../domain/identity.types";
import { UserRow } from "../infrastructure/iam.tables";
import { UserRepository } from "../infrastructure/user.repository";
import {
  MembershipView,
  WorkspaceRepository,
} from "../infrastructure/workspace.repository";

const DEFAULT_WORKSPACE_NAME = "My business";

@Injectable()
export class IdentityService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly users: UserRepository,
    private readonly workspaces: WorkspaceRepository,
  ) {}

  async signIn(phone: string): Promise<SignInIdentity> {
    return this.db.transaction(async (tx) => {
      const existing = await this.users.findByPhone(phone, tx);
      const user = existing ?? (await this.users.create(phone, tx));
      await this.users.touchLogin(user.id, tx);
      const membership =
        (await this.workspaces.firstMembership(user.id, tx)) ??
        (await this.workspaces.createWithOwner(
          user.id,
          DEFAULT_WORKSPACE_NAME,
          tx,
        ));
      return {
        user: toProfile(user),
        workspace: toSummary(membership),
        isNewUser: !existing,
      };
    });
  }

  async signInWithGoogle(google: GoogleIdentity): Promise<SignInIdentity> {
    return this.db.transaction(async (tx) => {
      const bySub = await this.users.findByGoogleSub(google.sub, tx);
      const byEmail = bySub
        ? null
        : await this.users.findByEmail(google.email, tx);
      const existing = bySub ?? byEmail;
      const user = existing
        ? await this.users.update(
            existing.id,
            {
              googleSub: google.sub,
              email: google.email,
              name: existing.name ?? google.name,
              avatarUrl: google.picture ?? existing.avatarUrl,
              lastLoginAt: new Date(),
            },
            tx,
          )
        : await this.users.createFromGoogle(
            {
              googleSub: google.sub,
              email: google.email,
              name: google.name,
              avatarUrl: google.picture,
            },
            tx,
          );
      if (!existing) await this.users.touchLogin(user.id, tx);
      const membership =
        (await this.workspaces.firstMembership(user.id, tx)) ??
        (await this.workspaces.createWithOwner(
          user.id,
          DEFAULT_WORKSPACE_NAME,
          tx,
        ));
      return {
        user: toProfile(user),
        workspace: toSummary(membership),
        isNewUser: !existing,
      };
    });
  }

  async me(ctx: TenantContext): Promise<MeView> {
    const [user, membership] = await Promise.all([
      this.users.findById(ctx.userId),
      this.workspaces.membership(ctx.userId, ctx.workspaceId),
    ]);
    if (!user || !membership) {
      throw new NotFoundError("Your account could not be found.");
    }
    return {
      user: toProfile(user),
      workspace: toSummary(membership),
    };
  }

  async hasMembership(userId: string, workspaceId: string): Promise<boolean> {
    return (await this.workspaces.membership(userId, workspaceId)) !== null;
  }
}

function toProfile(u: UserRow) {
  return {
    id: u.id,
    phone: u.phone,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
  };
}

function toSummary(m: MembershipView) {
  return { id: m.workspaceId, name: m.name, role: m.role };
}
