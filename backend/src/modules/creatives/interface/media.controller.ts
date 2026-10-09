import {
  Controller,
  Get,
  Headers,
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
    @Headers("range") range?: string,
  ): Promise<void> {
    const ext = key.split(".").pop() ?? "";
    const type = TYPES[ext];
    const head = type ? await this.storage.read(key) : null;
    if (!head || !type) throw new NotFoundException();
    head.stream.destroy();
    const common = {
      "content-type": type,
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    };
    const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
    if (match && (match[1] || match[2])) {
      const size = head.size;
      let start = match[1] ? Number(match[1]) : size - Number(match[2]);
      let end = match[1] && match[2] ? Number(match[2]) : size - 1;
      start = Math.max(0, start);
      end = Math.min(end, size - 1);
      if (start > end) {
        await reply
          .status(416)
          .header("content-range", `bytes */${size}`)
          .send();
        return;
      }
      const part = await this.storage.read(key, { start, end });
      await reply
        .status(206)
        .headers({
          ...common,
          "content-range": `bytes ${start}-${end}/${size}`,
          "content-length": String(end - start + 1),
        })
        .send(part!.stream);
      return;
    }
    const file = await this.storage.read(key);
    await reply
      .headers({ ...common, "content-length": String(file!.size) })
      .send(file!.stream);
  }
}
