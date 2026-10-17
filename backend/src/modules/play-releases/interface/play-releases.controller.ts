import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiDefaultResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { PlayActor } from "@modules/play/application/play-engine.service";
import { ErrorResponseDto } from "@shared/errors/error-response.dto";
import { ValidationError } from "@shared/errors/domain-error";
import { CurrentUser } from "@shared/security/current-user.decorator";
import { TenantContext } from "@shared/tenant/tenant-context";

import { PlayReleasesService } from "../application/play-releases.service";
import { RolloutGuardian } from "../application/rollout-guardian.service";
import {
  DraftNotesDto,
  GuardianDto,
  HealthQueryDto,
  IssuesQueryDto,
  PromoteDto,
  RolloutDto,
  SaveNotesDto,
} from "./dto/play-releases.dto";
import {
  AppHealthDto,
  CrashExplanationDto,
  DraftedNotesDto,
  ErrorIssueDetailDto,
  ErrorIssueListDto,
  GuardianCheckDto,
  GuardianViewDto,
  ReleasesOverviewDto,
  TrackChangeDto,
} from "./dto/play-releases-response.dto";

const actor = (ctx: TenantContext): PlayActor => ({
  userId: ctx.userId,
  workspaceId: ctx.workspaceId,
  via: "app",
});

const id = new ParseUUIDPipe();

const issueId = (value: string) => {
  if (!/^[\w-]{1,100}$/.test(value))
    throw new ValidationError("This crash cluster id isn't valid.");
  return value;
};

@ApiTags("Play releases")
@ApiDefaultResponse({ type: ErrorResponseDto })
@Controller("play-releases")
export class PlayReleasesController {
  constructor(
    private readonly releases: PlayReleasesService,
    private readonly guardian: RolloutGuardian,
  ) {}

  @Get("apps/:id")
  overview(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
  ): Promise<ReleasesOverviewDto> {
    return this.releases.overview(ctx.workspaceId, appId);
  }

  @Post("apps/:id/rollout")
  @HttpCode(HttpStatus.OK)
  async rollout(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Body() body: RolloutDto,
  ): Promise<TrackChangeDto> {
    return this.releases.rollout(actor(ctx), appId, body);
  }

  @Post("apps/:id/promote")
  @HttpCode(HttpStatus.OK)
  promote(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Body() body: PromoteDto,
  ): Promise<TrackChangeDto> {
    return this.releases.promote(actor(ctx), appId, body);
  }

  @Put("apps/:id/notes")
  saveNotes(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Body() body: SaveNotesDto,
  ): Promise<TrackChangeDto> {
    return this.releases.saveNotes(actor(ctx), appId, body);
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post("apps/:id/notes/draft")
  @HttpCode(HttpStatus.OK)
  draftNotes(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Body() body: DraftNotesDto,
  ): Promise<DraftedNotesDto> {
    return this.releases.draftNotes(ctx.workspaceId, appId, body);
  }

  @Get("apps/:id/guardian")
  guardianSettings(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
  ): Promise<GuardianViewDto> {
    return this.releases.guardian(ctx.workspaceId, appId);
  }

  @Put("apps/:id/guardian")
  updateGuardian(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Body() body: GuardianDto,
  ): Promise<GuardianViewDto> {
    return this.releases.updateGuardian(actor(ctx), appId, body);
  }

  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  @Post("apps/:id/guardian/check")
  @HttpCode(HttpStatus.OK)
  checkGuardian(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
  ): Promise<GuardianCheckDto> {
    return this.guardian.checkNow(ctx.workspaceId, appId);
  }

  @Get("apps/:id/health")
  health(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Query() query: HealthQueryDto,
  ): Promise<AppHealthDto> {
    return this.releases.health(ctx.workspaceId, appId, query.days ?? 28);
  }

  @Get("apps/:id/issues")
  issues(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Query() query: IssuesQueryDto,
  ): Promise<ErrorIssueListDto> {
    return this.releases.issues(ctx.workspaceId, appId, query.type ?? null);
  }

  @Get("apps/:id/issues/:issueId")
  issue(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Param("issueId") cluster: string,
  ): Promise<ErrorIssueDetailDto> {
    return this.releases.issueView(ctx.workspaceId, appId, issueId(cluster));
  }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post("apps/:id/issues/:issueId/explain")
  @HttpCode(HttpStatus.OK)
  explain(
    @CurrentUser() ctx: TenantContext,
    @Param("id", id) appId: string,
    @Param("issueId") cluster: string,
  ): Promise<CrashExplanationDto> {
    return this.releases.explain(ctx.workspaceId, appId, issueId(cluster));
  }
}
