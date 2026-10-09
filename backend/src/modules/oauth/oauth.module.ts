import { Module } from "@nestjs/common";

import { IamModule } from "@modules/iam/iam.module";
import { MetaModule } from "@modules/meta/meta.module";

import { AuthorizationService } from "./application/authorization.service";
import { ClientRegistryService } from "./application/client-registry.service";
import { GrantService } from "./application/grant.service";
import { TokenEndpointService } from "./application/token-endpoint.service";
import { CimdFetcher } from "./infrastructure/cimd.fetcher";
import { OAuthClientRepository } from "./infrastructure/oauth-client.repository";
import { OAuthGrantRepository } from "./infrastructure/oauth-grant.repository";
import { AuthorizationController } from "./interface/authorization.controller";
import { OAuthServerController } from "./interface/oauth-server.controller";

@Module({
  imports: [IamModule, MetaModule],
  controllers: [OAuthServerController, AuthorizationController],
  providers: [
    AuthorizationService,
    ClientRegistryService,
    GrantService,
    TokenEndpointService,
    CimdFetcher,
    OAuthClientRepository,
    OAuthGrantRepository,
  ],
  exports: [GrantService],
})
export class OAuthModule {}
