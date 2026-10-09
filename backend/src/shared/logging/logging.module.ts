import { randomUUID } from "crypto";
import { IncomingMessage } from "http";
import { DynamicModule, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";

import { AppConfig, isProduction } from "@shared/config/app-config";

@Module({})
export class LoggingModule {
  static forRoot(service: "api" | "worker"): DynamicModule {
    return {
      module: LoggingModule,
      imports: [
        LoggerModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: AppConfig) => ({
            pinoHttp: {
              level: config.get("LOG_LEVEL", { infer: true }),
              genReqId: (req: IncomingMessage) => {
                const header = req.headers["x-request-id"];
                return typeof header === "string" && header.length <= 100
                  ? header
                  : randomUUID();
              },
              redact: {
                paths: [
                  "req.headers.authorization",
                  "req.headers.cookie",
                  'res.headers["set-cookie"]',
                ],
                censor: "[redacted]",
              },
              customProps: () => ({ service }),
              serializers: {
                req: (req: { id: string; method: string; url: string }) => ({
                  id: req.id,
                  method: req.method,
                  url: req.url,
                }),
                res: (res: { statusCode: number }) => ({
                  statusCode: res.statusCode,
                }),
              },
              autoLogging: { ignore: (req) => req.url === "/health" },
              transport: isProduction(config)
                ? undefined
                : {
                    target: "pino-pretty",
                    options: {
                      singleLine: true,
                      translateTime: "SYS:HH:MM:ss",
                    },
                  },
            },
          }),
        }),
      ],
    };
  }
}
