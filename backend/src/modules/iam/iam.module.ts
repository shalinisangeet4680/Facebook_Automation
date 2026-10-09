import { Module } from "@nestjs/common";

import { IdentityService } from "./application/identity.service";
import { UserRepository } from "./infrastructure/user.repository";
import { WorkspaceRepository } from "./infrastructure/workspace.repository";
import { MeController } from "./interface/me.controller";

@Module({
  controllers: [MeController],
  providers: [IdentityService, UserRepository, WorkspaceRepository],
  exports: [IdentityService],
})
export class IamModule {}
