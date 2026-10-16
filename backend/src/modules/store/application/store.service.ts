import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { imageSize } from "image-size";

import { AuditService } from "@modules/audit/application/audit.service";
import { CreativesService } from "@modules/creatives/application/creatives.service";
import {
  MEDIA_STORAGE,
  MediaStorage,
} from "@modules/creatives/domain/ports/media-storage";
import { AppConfig, appUrl, mediaUrl } from "@shared/config/app-config";
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@shared/errors/domain-error";
import { CryptoService } from "@shared/security/crypto.service";
import { uuidv7 } from "@shared/util/uuid";

import {
  AssetMeta,
  FEATURE_STYLES,
  LANG,
  MAX_ASSETS_PER_PROJECT,
  MAX_ASSET_BYTES,
  MAX_LANGUAGES,
  SLUG,
  STORE_IMAGE_MIME,
  STORE_SIZES,
  STORE_STYLES,
  StoreSize,
  StoreStyle,
  UPLOAD_TOKEN_TTL_SECONDS,
  assetProblem,
  creativeName,
  slugify,
  statusAfterUpload,
} from "../domain/store.rules";
import { StoreRepository } from "../infrastructure/store.repository";
import { StoreAssetRow, StoreProjectRow } from "../infrastructure/store.tables";

export interface StoreActor {
  userId: string;
  workspaceId: string;
  via: string;
}

export interface StoreChoice {
  style: string;
  languages: string[];
  sizes: string[];
}

@Injectable()
export class StoreService {
  constructor(
    private readonly repo: StoreRepository,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly creatives: CreativesService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  projectUrl(id: string): string {
    return `${appUrl(this.config)}/store/${id}`;
  }

  uploadUrl(): string {
    return `${appUrl(this.config)}/api/v1/store-uploads`;
  }

  options() {
    return {
      styles: [...STORE_STYLES],
      featureStyles: [...FEATURE_STYLES],
      sizes: [...STORE_SIZES],
    };
  }

  private assetView(row: StoreAssetRow) {
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      style: row.style,
      lang: row.lang,
      size: row.size,
      url: mediaUrl(this.config, row.storageKey),
      width: row.width,
      height: row.height,
      bytes: row.bytes,
    };
  }

  private summary(row: StoreProjectRow, assets: StoreAssetRow[]) {
    const counts = {
      screens: 0,
      previews: 0,
      screenshots: 0,
      featureGraphics: 0,
    };
    for (const a of assets) {
      if (a.kind === "screen") counts.screens++;
      else if (a.kind === "preview") counts.previews++;
      else if (a.kind === "screenshot") counts.screenshots++;
      else counts.featureGraphics++;
    }
    const cover =
      assets.find((a) => a.kind === "screenshot" && a.size === "phone") ??
      assets.find((a) => a.kind === "preview" && a.size === "phone") ??
      assets.find((a) => a.kind === "screen");
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      languages: row.languages,
      choice: row.chosenStyle
        ? {
            style: row.chosenStyle as StoreStyle,
            languages: row.chosenLanguages ?? [],
            sizes: (row.chosenSizes ?? []) as StoreSize[],
          }
        : null,
      counts,
      coverUrl: cover ? mediaUrl(this.config, cover.storageKey) : null,
      url: this.projectUrl(row.id),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async list(workspaceId: string) {
    const rows = await this.repo.listProjects(workspaceId, 100);
    const data = await Promise.all(
      rows.map(async (r) => this.summary(r, await this.repo.assets(r.id))),
    );
    return { data };
  }

  private async project(workspaceId: string, id: string) {
    const row = await this.repo.findProject(workspaceId, id);
    if (!row) throw new NotFoundError("This store project doesn't exist.");
    return row;
  }

  async get(workspaceId: string, id: string) {
    const row = await this.project(workspaceId, id);
    const assets = await this.repo.assets(row.id);
    return {
      ...this.summary(row, assets),
      assets: assets.map((a) => this.assetView(a)),
      options: this.options(),
    };
  }

  private cleanLanguages(languages: string[]): string[] {
    const unique = [...new Set(languages.map((l) => l.trim()))];
    const bad = unique.filter((l) => !LANG.test(l));
    if (bad.length)
      throw new ValidationError(
        `Use language codes like en or pt-BR (got ${bad.join(", ")}).`,
      );
    if (unique.length > MAX_LANGUAGES)
      throw new ValidationError(`Use at most ${MAX_LANGUAGES} languages.`);
    return unique;
  }

  private async issueToken(row: StoreProjectRow) {
    const token = `stu_${this.crypto.randomToken(32)}`;
    const expiresAt = new Date(Date.now() + UPLOAD_TOKEN_TTL_SECONDS * 1000);
    await this.repo.updateProject(row.id, {
      uploadTokenHash: this.crypto.hash(token),
      uploadTokenExpiresAt: expiresAt,
    });
    return {
      uploadUrl: this.uploadUrl(),
      uploadToken: token,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async save(
    actor: StoreActor,
    input: { name: string; slug?: string; languages: string[] },
  ) {
    const name = input.name.trim().slice(0, 80);
    if (!name) throw new ValidationError("Give the app a name.");
    const slug = input.slug?.trim() || slugify(name);
    if (!SLUG.test(slug))
      throw new ValidationError(
        "slug must be lowercase letters, digits and dashes, up to 63 characters.",
      );
    const row = await this.repo.upsertProject({
      workspaceId: actor.workspaceId,
      slug,
      name,
      languages: this.cleanLanguages(input.languages),
      createdBy: actor.userId,
    });
    await this.record(actor, "store.project_saved", row.id, { name, slug });
    return {
      projectId: row.id,
      url: this.projectUrl(row.id),
      ...(await this.issueToken(row)),
    };
  }

  async startUpload(actor: StoreActor, id: string) {
    const row = await this.project(actor.workspaceId, id);
    return { projectId: row.id, ...(await this.issueToken(row)) };
  }

  async forClaude(workspaceId: string, id: string) {
    const detail = await this.get(workspaceId, id);
    const { assets, ...rest } = detail;
    return {
      ...rest,
      next:
        detail.status === "draft"
          ? "Upload the screens and a style preview, then ask the user to choose a style at url."
          : detail.status === "choosing"
            ? "Waiting for the user to choose a style, languages and sizes at url."
            : detail.status === "style_chosen"
              ? "Render the set with the chosen style, languages and sizes, then upload it."
              : "The set is uploaded. The user can download it or add screenshots to Creatives at url.",
      screens: assets.filter((a) => a.kind === "screen").map((a) => a.name),
    };
  }

  async choose(actor: StoreActor, id: string, choice: StoreChoice) {
    const row = await this.project(actor.workspaceId, id);
    if (!(STORE_STYLES as readonly string[]).includes(choice.style))
      throw new ValidationError(
        `Choose one of these styles: ${STORE_STYLES.join(", ")}.`,
      );
    const languages = this.cleanLanguages(choice.languages);
    if (!languages.length) throw new ValidationError("Choose a language.");
    const unknown = row.languages.length
      ? languages.filter((l) => !row.languages.includes(l))
      : [];
    if (unknown.length)
      throw new ValidationError(
        `These languages aren't in the project: ${unknown.join(", ")}.`,
      );
    const sizes = [...new Set(choice.sizes)];
    if (!sizes.length) throw new ValidationError("Choose at least one size.");
    if (sizes.some((s) => !(STORE_SIZES as readonly string[]).includes(s)))
      throw new ValidationError(`Sizes can be ${STORE_SIZES.join(", ")}.`);
    await this.repo.updateProject(row.id, {
      chosenStyle: choice.style,
      chosenLanguages: languages,
      chosenSizes: sizes,
      status: "style_chosen",
    });
    await this.record(actor, "store.style_chosen", row.id, {
      style: choice.style,
      languages,
      sizes,
    });
    return this.get(actor.workspaceId, row.id);
  }

  async upload(
    token: string | undefined,
    meta: AssetMeta,
    file: { buffer: Buffer; mime: string },
  ) {
    if (!token?.startsWith("stu_"))
      throw new UnauthorizedError("Send the upload token from Claude.");
    const project = await this.repo.findByTokenHash(this.crypto.hash(token));
    if (
      !project ||
      !project.uploadTokenExpiresAt ||
      project.uploadTokenExpiresAt.getTime() < Date.now()
    )
      throw new UnauthorizedError(
        "This upload token is invalid or expired. Ask Claude for a new one.",
      );
    const problem = assetProblem(meta);
    if (problem) throw new ValidationError(problem);
    const ext = STORE_IMAGE_MIME[file.mime];
    if (!ext) throw new ValidationError("Upload a PNG, JPEG or WebP image.");
    if (file.buffer.length > MAX_ASSET_BYTES)
      throw new ValidationError("Images can be at most 15 MB.");
    let size: { width?: number; height?: number; type?: string };
    try {
      size = imageSize(file.buffer);
    } catch {
      throw new ValidationError("This file isn't a readable image.");
    }
    const detected = size.type === "jpg" ? "jpeg" : size.type;
    if (
      !size.width ||
      !size.height ||
      STORE_IMAGE_MIME[`image/${detected}`] === undefined
    )
      throw new ValidationError("This file isn't a readable image.");
    if (
      Math.min(size.width, size.height) < 100 ||
      Math.max(size.width, size.height) > 8000
    )
      throw new ValidationError("Images must be 100 to 8000 pixels per side.");
    if ((await this.repo.countAssets(project.id)) >= MAX_ASSETS_PER_PROJECT)
      throw new ValidationError(
        `A project can hold ${MAX_ASSETS_PER_PROJECT} images. Delete the project and start again.`,
      );

    const key = `${uuidv7()}-${randomBytes(18).toString("base64url")}.${ext}`;
    await this.storage.put(key, file.buffer, file.mime);
    let replaced: StoreAssetRow | null = null;
    let row: StoreAssetRow;
    try {
      row = await this.repo.transaction(async (tx) => {
        const variant = { projectId: project.id, ...meta };
        replaced = await this.repo.findVariant(tx, variant);
        const inserted = await this.repo.replaceAsset(tx, replaced, {
          workspaceId: project.workspaceId,
          ...variant,
          storageKey: key,
          mime: file.mime,
          width: size.width!,
          height: size.height!,
          bytes: file.buffer.length,
        });
        await this.repo.updateProject(
          project.id,
          { status: statusAfterUpload(project.status, meta.kind) },
          tx,
        );
        return inserted;
      });
    } catch (err) {
      await this.storage.remove(key).catch(() => undefined);
      throw err;
    }
    const old = replaced as StoreAssetRow | null;
    if (old) await this.storage.remove(old.storageKey).catch(() => undefined);
    return this.assetView(row);
  }

  async addToCreatives(actor: StoreActor, id: string, assetIds: string[]) {
    const project = await this.project(actor.workspaceId, id);
    const ids = [...new Set(assetIds)];
    if (!ids.length) throw new ValidationError("Choose images to add.");
    if (ids.length > 24)
      throw new ValidationError("Add at most 24 images at a time.");
    const assets = await this.repo.assetsByIds(project.id, ids);
    if (assets.length !== ids.length)
      throw new NotFoundError("Some of these images aren't in the project.");
    if (
      assets.some(
        (a) => a.kind !== "screenshot" && a.kind !== "feature_graphic",
      )
    )
      throw new ValidationError(
        "Only final screenshots and feature graphics can go to Creatives.",
      );
    const created = [];
    for (const asset of assets) {
      const file = await this.storage.read(asset.storageKey);
      if (!file)
        throw new NotFoundError(`${asset.name} is missing from storage.`);
      const chunks: Buffer[] = [];
      for await (const chunk of file.stream) chunks.push(chunk as Buffer);
      created.push(
        await this.creatives.upload(
          actor,
          {
            buffer: Buffer.concat(chunks),
            mime: asset.mime,
            filename: asset.name,
          },
          creativeName(project.name, asset),
        ),
      );
    }
    return { data: created };
  }

  async remove(actor: StoreActor, id: string) {
    const project = await this.project(actor.workspaceId, id);
    const assets = await this.repo.assets(project.id);
    await this.repo.deleteProject(project.id);
    await Promise.all(
      assets.map((a) =>
        this.storage.remove(a.storageKey).catch(() => undefined),
      ),
    );
    await this.record(actor, "store.project_deleted", project.id, {
      name: project.name,
    });
  }

  private record(
    actor: StoreActor,
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
