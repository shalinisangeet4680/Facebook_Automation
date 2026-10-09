import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { SkipThrottle } from "@nestjs/throttler";

import { DependencyHealth } from "./infrastructure/dependency.health";

@SkipThrottle()
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly dependencies: DependencyHealth,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.dependencies.database(),
      () => this.dependencies.redisPing(),
    ]);
  }
}
