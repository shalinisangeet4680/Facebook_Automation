import { Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";

import { validateEnv } from "./env.validation";

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [".env"],
      validate: (fileConfig) => validateEnv({ ...fileConfig, ...process.env }),
    }),
  ],
})
export class ConfigModule {}
