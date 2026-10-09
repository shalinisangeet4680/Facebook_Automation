import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiDefaultResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { FastifyRequest } from "fastify";

import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { ValidationError } from "@shared/errors/domain-error";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { CreativesService } from "../application/creatives.service";
import { MAX_UPLOAD_BYTES } from "../domain/creative.rules";
import { CreativeDto, CreativeListDto } from "./dto/creative.dto";

const actor = (ctx: TenantContext) => ({
  userId: ctx.userId,
  workspaceId: ctx.workspaceId,
  via: "app",
});

@ApiTags("Creatives")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("creatives")
export class CreativesController {
  constructor(private readonly creatives: CreativesService) {}

  @Get()
  list(@CurrentUser() ctx: TenantContext): Promise<CreativeListDto> {
    return this.creatives.list(ctx.workspaceId);
  }

  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  @Post()
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", format: "binary" },
        name: { type: "string" },
      },
    },
  })
  async upload(
    @CurrentUser() ctx: TenantContext,
    @Req() req: FastifyRequest,
  ): Promise<CreativeDto> {
    if (!req.isMultipart())
      throw new ValidationError("Send the image as multipart/form-data.");
    const file = await req.file({
      limits: { fileSize: MAX_UPLOAD_BYTES + 1, files: 1 },
    });
    if (!file) throw new ValidationError("Choose an image to upload.");
    const buffer = await file.toBuffer().catch(() => {
      throw new ValidationError("Images can be at most 8 MB.");
    });
    const nameField = file.fields.name as { value?: unknown } | undefined;
    const name =
      typeof nameField?.value === "string" && nameField.value.trim()
        ? nameField.value.trim()
        : undefined;
    return this.creatives.upload(
      actor(ctx),
      { buffer, mime: file.mimetype, filename: file.filename },
      name,
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() ctx: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.creatives.remove(actor(ctx), id, () => Promise.resolve(false));
  }
}
