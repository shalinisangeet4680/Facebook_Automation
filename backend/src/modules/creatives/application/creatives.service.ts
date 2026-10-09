import { Resvg } from "@resvg/resvg-js";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, desc, eq, inArray } from "drizzle-orm";
import { imageSize } from "image-size";
import { randomBytes } from "crypto";

import { AuditService } from "@modules/audit/application/audit.service";
import { AppConfig, mediaUrl } from "@shared/config/app-config";
import { DATABASE, Database, firstOrNull } from "@shared/database/database";
import { NotFoundError, ValidationError } from "@shared/errors/domain-error";
import { uuidv7 } from "@shared/util/uuid";

import {
  CREATIVE_MIME,
  MAX_SVG_BYTES,
  MAX_UPLOAD_BYTES,
  SVG_FORMATS,
  SvgFormat,
  sanitizeSvg,
} from "../domain/creative.rules";
import { MEDIA_STORAGE, MediaStorage } from "../domain/ports/media-storage";
import { socialPosts } from "../../social/infrastructure/social.tables";
import { CreativeRow, creatives } from "../infrastructure/creatives.tables";

export interface CreativeActor {
  userId: string;
  workspaceId: string;
  via: string;
}

export interface CreativeView {
  id: string;
  name: string;
  source: "upload" | "claude";
  url: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
}

@Injectable()
export class CreativesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    private readonly audit: AuditService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  view(row: CreativeRow): CreativeView {
    return {
      id: row.id,
      name: row.name,
      source: row.source,
      url: mediaUrl(this.config, row.storageKey),
      mime: row.mime,
      width: row.width,
      height: row.height,
      bytes: row.bytes,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async upload(
    actor: CreativeActor,
    file: { buffer: Buffer; mime: string; filename: string },
    name?: string,
  ) {
    const ext = CREATIVE_MIME[file.mime];
    if (!ext) throw new ValidationError("Upload a PNG, JPEG or WebP image.");
    if (file.buffer.length > MAX_UPLOAD_BYTES)
      throw new ValidationError("Images can be at most 8 MB.");
    let size: { width?: number; height?: number; type?: string };
    try {
      size = imageSize(file.buffer);
    } catch {
      throw new ValidationError("This file isn't a readable image.");
    }
    if (
      !size.width ||
      !size.height ||
      CREATIVE_MIME[`image/${size.type === "jpg" ? "jpeg" : size.type}`] ===
        undefined
    ) {
      throw new ValidationError("This file isn't a readable image.");
    }
    if (size.width < 500 || size.height < 500) {
      throw new ValidationError(
        "Use an image at least 500 × 500 pixels. 1080 × 1080 works best.",
      );
    }
    return this.store(actor, {
      name:
        (name ?? file.filename.replace(/\.[a-z0-9]+$/i, "")).slice(0, 120) ||
        "Image",
      source: "upload",
      body: file.buffer,
      mime: file.mime,
      ext,
      width: size.width,
      height: size.height,
    });
  }

  async fromSvg(
    actor: CreativeActor,
    input: { name: string; svg: string; format: SvgFormat },
  ) {
    if (Buffer.byteLength(input.svg) > MAX_SVG_BYTES)
      throw new ValidationError("The SVG is too large (max 400 KB).");
    const svg = sanitizeSvg(input.svg);
    if (!svg) {
      throw new ValidationError(
        "Send a self-contained SVG: no scripts, event handlers, foreignObject or external links. Embed images as data URIs.",
      );
    }
    const { width, height } = SVG_FORMATS[input.format];
    let png: Buffer;
    try {
      const rendered = new Resvg(svg, {
        fitTo: { mode: "width", value: width },
        font: { loadSystemFonts: true, defaultFontFamily: "Helvetica" },
        background: "#ffffff",
      }).render();
      png = rendered.asPng();
      if (Math.abs(rendered.height - height) > 2) {
        throw new ValidationError(
          `The SVG must have a ${width}:${height} viewBox for the ${input.format} format (it rendered ${rendered.width}×${rendered.height}).`,
        );
      }
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new ValidationError(
        `The SVG could not be rendered: ${(err as Error).message}`,
      );
    }
    return this.store(actor, {
      name: input.name.slice(0, 120),
      source: "claude",
      body: png,
      mime: "image/png",
      ext: "png",
      width,
      height,
    });
  }

  async list(workspaceId: string): Promise<{ data: CreativeView[] }> {
    const rows = await this.db
      .select()
      .from(creatives)
      .where(eq(creatives.workspaceId, workspaceId))
      .orderBy(desc(creatives.createdAt))
      .limit(200);
    return { data: rows.map((r) => this.view(r)) };
  }

  async get(workspaceId: string, id: string): Promise<CreativeRow> {
    const row = firstOrNull(
      await this.db
        .select()
        .from(creatives)
        .where(
          and(eq(creatives.id, id), eq(creatives.workspaceId, workspaceId)),
        )
        .limit(1),
    );
    if (!row) throw new NotFoundError("This creative doesn't exist.");
    return row;
  }

  async remove(actor: CreativeActor, id: string): Promise<void> {
    const row = await this.get(actor.workspaceId, id);
    const pending = await this.db
      .select({ id: socialPosts.id })
      .from(socialPosts)
      .where(
        and(
          eq(socialPosts.creativeId, id),
          inArray(socialPosts.status, ["scheduled", "publishing"]),
        ),
      )
      .limit(1);
    if (pending.length) {
      throw new ValidationError(
        "A scheduled post uses this image. Cancel the post first.",
      );
    }
    await this.db.delete(creatives).where(eq(creatives.id, row.id));
    await this.storage.remove(row.storageKey);
    await this.record(actor, "creative.deleted", row.id, { name: row.name });
  }

  private async store(
    actor: CreativeActor,
    input: {
      name: string;
      source: "upload" | "claude";
      body: Buffer;
      mime: string;
      ext: string;
      width: number;
      height: number;
    },
  ): Promise<CreativeView> {
    const id = uuidv7();
    const key = `${id}-${randomBytes(18).toString("base64url")}.${input.ext}`;
    await this.storage.put(key, input.body, input.mime);
    const [row] = await this.db
      .insert(creatives)
      .values({
        id,
        workspaceId: actor.workspaceId,
        name: input.name,
        source: input.source,
        storageKey: key,
        mime: input.mime,
        width: input.width,
        height: input.height,
        bytes: input.body.length,
        createdBy: actor.userId,
      })
      .returning();
    await this.record(actor, "creative.created", id, {
      name: input.name,
      source: input.source,
    });
    return this.view(row!);
  }

  private record(
    actor: CreativeActor,
    action: string,
    target: string,
    data: Record<string, unknown>,
  ) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actor: "user",
      actorId: actor.userId,
      action,
      target,
      data: { ...data, via: actor.via },
    });
  }
}
