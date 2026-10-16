import { Controller, Headers, Post, Req } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { FastifyRequest } from "fastify";

import { ValidationError } from "@shared/errors/domain-error";
import { ExternalClient, Public } from "@shared/security/public.decorator";

import { StoreService } from "../application/store.service";
import { ASSET_KINDS, AssetKind, MAX_ASSET_BYTES } from "../domain/store.rules";

const field = (fields: Record<string, unknown>, name: string): string => {
  const value = (fields[name] as { value?: unknown } | undefined)?.value;
  return typeof value === "string" ? value.trim() : "";
};

@ApiExcludeController()
@Public()
@ExternalClient()
@Controller("store-uploads")
export class StoreUploadController {
  constructor(private readonly store: StoreService) {}

  @Throttle({ default: { limit: 2000, ttl: 3_600_000 } })
  @Post()
  async upload(
    @Req() req: FastifyRequest,
    @Headers("x-upload-token") token?: string,
  ) {
    if (!req.isMultipart())
      throw new ValidationError("Send the image as multipart/form-data.");
    const file = await req.file({
      limits: { fileSize: MAX_ASSET_BYTES + 1, files: 1, fields: 8 },
    });
    if (!file) throw new ValidationError("Attach the image as file.");
    const buffer = await file.toBuffer().catch(() => {
      throw new ValidationError("Images can be at most 15 MB.");
    });
    const kind = field(file.fields, "kind");
    if (!(ASSET_KINDS as readonly string[]).includes(kind))
      throw new ValidationError(
        `kind must be one of ${ASSET_KINDS.join(", ")}`,
      );
    return this.store.upload(
      token,
      {
        kind: kind as AssetKind,
        name: field(file.fields, "name"),
        style: field(file.fields, "style"),
        lang: field(file.fields, "lang"),
        size: field(file.fields, "size"),
      },
      { buffer, mime: file.mimetype },
    );
  }
}
