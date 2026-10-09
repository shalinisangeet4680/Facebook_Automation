import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";

import { AuditService } from "@modules/audit/application/audit.service";
import { CreativesService } from "@modules/creatives/application/creatives.service";
import { MetaConnectionService } from "@modules/meta/application/meta-connection.service";
import { AssetView } from "@modules/meta/domain/meta.types";
import {
  META_PROFILE,
  MetaProfile,
} from "@modules/meta/domain/ports/meta-profile";
import { AppConfig, mediaUrl } from "@shared/config/app-config";
import { DATABASE, Database, firstOrNull } from "@shared/database/database";
import {
  CodedError,
  DomainError,
  ValidationError,
} from "@shared/errors/domain-error";
import { ErrorCode } from "@shared/errors/error-codes";

import {
  facebookChecks,
  instagramChecks,
  score,
} from "../domain/profile.checks";
import {
  draftSchema,
  FacebookPart,
  ProfileDraft,
} from "../domain/profile.draft";
import { profileDrafts } from "../infrastructure/profile.tables";

export interface ProfileActor {
  userId: string;
  workspaceId: string;
  via: string;
}

@Injectable()
export class ProfileService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(META_PROFILE) private readonly profiles: MetaProfile,
    private readonly connections: MetaConnectionService,
    private readonly creatives: CreativesService,
    private readonly audit: AuditService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  async checkup(workspaceId: string) {
    const { page, instagram } = await this.channels(workspaceId);
    const token = await this.connections.accessToken(workspaceId);
    const [facebook, ig, draft] = await Promise.all([
      page
        ? this.profiles.facebook(token, page.externalId)
        : Promise.resolve(null),
      instagram
        ? this.profiles.instagram(token, instagram.externalId)
        : Promise.resolve(null),
      this.draft(workspaceId),
    ]);
    const fbChecks = facebook ? facebookChecks(facebook) : [];
    const igChecks = ig ? instagramChecks(ig) : [];
    return {
      facebook: facebook
        ? { profile: facebook, checks: fbChecks, score: score(fbChecks) }
        : null,
      instagram: ig
        ? { profile: ig, checks: igChecks, score: score(igChecks) }
        : null,
      draft: await this.draftView(workspaceId, draft),
    };
  }

  async saveDraft(actor: ProfileActor, input: unknown) {
    const parsed = draftSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(
        `The profile draft is not valid: ${parsed.error.issues
          .slice(0, 4)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      );
    }
    const draft = parsed.data;
    for (const id of [
      draft.facebook.pictureCreativeId,
      draft.facebook.coverCreativeId,
      draft.instagram.pictureCreativeId,
    ]) {
      if (id) await this.creatives.get(actor.workspaceId, id);
    }
    await this.db
      .insert(profileDrafts)
      .values({
        workspaceId: actor.workspaceId,
        facebook: draft.facebook as Record<string, unknown>,
        instagram: draft.instagram as Record<string, unknown>,
        source: actor.via,
      })
      .onConflictDoUpdate({
        target: profileDrafts.workspaceId,
        set: {
          facebook: draft.facebook as Record<string, unknown>,
          instagram: draft.instagram as Record<string, unknown>,
          source: actor.via,
        },
      });
    await this.record(actor, "profile.draft_saved", {});
    return this.draftView(actor.workspaceId, draft);
  }

  async applyFacebook(actor: ProfileActor, parts: FacebookPart[]) {
    const { page } = await this.channels(actor.workspaceId);
    if (!page)
      throw new CodedError(
        ErrorCode.META_ASSETS_MISSING,
        422,
        "Select a Facebook Page in Setup first.",
      );
    const draft = (await this.draft(actor.workspaceId)).facebook;
    const token = await this.connections.accessToken(actor.workspaceId);
    const results: { part: FacebookPart; ok: boolean; error: string | null }[] =
      [];

    const textParts = parts.filter((p) =>
      ["about", "description", "website", "phone", "email"].includes(p),
    ) as Exclude<FacebookPart, "picture" | "cover">[];
    for (const part of textParts) {
      const value = draft[part];
      if (!value) {
        results.push({
          part,
          ok: false,
          error: "Nothing drafted for this field.",
        });
        continue;
      }
      results.push(
        await this.attempt(part, () =>
          this.profiles.updateFacebook(token, page.externalId, {
            [part]: value,
          }),
        ),
      );
    }
    for (const part of parts.filter((p) => p === "picture" || p === "cover")) {
      const creativeId =
        part === "picture" ? draft.pictureCreativeId : draft.coverCreativeId;
      if (!creativeId) {
        results.push({ part, ok: false, error: "Choose an image first." });
        continue;
      }
      const creative = await this.creatives.get(actor.workspaceId, creativeId);
      const url = mediaUrl(this.config, creative.storageKey);
      results.push(
        await this.attempt(part, () =>
          part === "picture"
            ? this.profiles.setFacebookPicture(token, page.externalId, url)
            : this.profiles.setFacebookCover(token, page.externalId, url),
        ),
      );
    }
    await this.record(actor, "profile.facebook_applied", { results });
    return { results, checkup: await this.checkup(actor.workspaceId) };
  }

  private async attempt(part: FacebookPart, run: () => Promise<void>) {
    try {
      await run();
      return { part, ok: true, error: null };
    } catch (err) {
      return {
        part,
        ok: false,
        error:
          err instanceof DomainError || err instanceof Error
            ? err.message
            : "Meta rejected the change.",
      };
    }
  }

  private async channels(
    workspaceId: string,
  ): Promise<{ page: AssetView | null; instagram: AssetView | null }> {
    const { data } = await this.connections.listAssets(workspaceId);
    const primary = (kind: AssetView["kind"]) =>
      data.find((a) => a.kind === kind && a.isPrimary) ?? null;
    return { page: primary("page"), instagram: primary("instagram") };
  }

  private async draft(workspaceId: string): Promise<ProfileDraft> {
    const row = firstOrNull(
      await this.db
        .select()
        .from(profileDrafts)
        .where(eq(profileDrafts.workspaceId, workspaceId))
        .limit(1),
    );
    return draftSchema.parse({
      facebook: row?.facebook ?? {},
      instagram: row?.instagram ?? {},
    });
  }

  private async draftView(workspaceId: string, draft: ProfileDraft) {
    const image = async (id: string | null | undefined) => {
      if (!id) return null;
      try {
        const row = await this.creatives.get(workspaceId, id);
        return {
          id: row.id,
          name: row.name,
          url: mediaUrl(this.config, row.storageKey),
        };
      } catch {
        return null;
      }
    };
    return {
      facebook: {
        about: draft.facebook.about ?? null,
        description: draft.facebook.description ?? null,
        website: draft.facebook.website ?? null,
        phone: draft.facebook.phone ?? null,
        email: draft.facebook.email ?? null,
        picture: await image(draft.facebook.pictureCreativeId),
        cover: await image(draft.facebook.coverCreativeId),
      },
      instagram: {
        name: draft.instagram.name ?? null,
        bio: draft.instagram.bio ?? null,
        website: draft.instagram.website ?? null,
        picture: await image(draft.instagram.pictureCreativeId),
      },
    };
  }

  private record(
    actor: ProfileActor,
    action: string,
    data: Record<string, unknown>,
  ) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actor: "user",
      actorId: actor.userId,
      action,
      data: { ...data, via: actor.via },
    });
  }
}
