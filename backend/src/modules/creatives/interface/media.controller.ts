import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Res,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { FastifyReply } from "fastify";

import { Public } from "@shared/security/public.decorator";

import { MEDIA_STORAGE, MediaStorage } from "../domain/ports/media-storage";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller({ path: "media", version: VERSION_NEUTRAL })
export class MediaController {
  constructor(@Inject(MEDIA_STORAGE) private readonly storage: MediaStorage) {}

  @Get(":key")
  async serve(
    @Param("key") key: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const ext = key.split(".").pop() ?? "";
    const type = TYPES[ext];
    const file = type ? await this.storage.read(key) : null;
    if (!file || !type) throw new NotFoundException();
    await reply
      .header("content-type", type)
      .header("content-length", String(file.size))
      .header("cache-control", "public, max-age=31536000, immutable")
      .header("x-content-type-options", "nosniff")
      .send(file.stream);
  }
}
