import { Global, Inject, Module, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AppConfig } from "../config/app-config";
import {
  createDatabase,
  createSqlClient,
  DATABASE,
  SQL_CLIENT,
} from "./database";

@Global()
@Module({
  providers: [
    {
      provide: SQL_CLIENT,
      inject: [ConfigService],
      useFactory: (config: AppConfig) =>
        createSqlClient(config.get("DATABASE_URL", { infer: true })),
    },
    {
      provide: DATABASE,
      inject: [SQL_CLIENT],
      useFactory: createDatabase,
    },
  ],
  exports: [DATABASE, SQL_CLIENT],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(
    @Inject(SQL_CLIENT)
    private readonly client: ReturnType<typeof createSqlClient>,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}
