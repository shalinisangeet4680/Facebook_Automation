import fastifyCookie from "@fastify/cookie";
import fastifyHelmet from "@fastify/helmet";
import { VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { randomUUID } from "crypto";
import { IncomingMessage } from "http";
import { Logger } from "nestjs-pino";

import { AppConfig, isProduction, webOrigins } from "@shared/config/app-config";

import { AppModule } from "./app.module";

export async function createApp(): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    trustProxy: true,
    bodyLimit: 1_048_576,
    genReqId: (req: IncomingMessage) => {
      const header = req.headers["x-request-id"];
      return typeof header === "string" && header.length <= 100
        ? header
        : randomUUID();
    },
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  const config = app.get<AppConfig>(ConfigService);
  const production = isProduction(config);

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: production ? undefined : false,
  });
  await app.register(fastifyCookie);

  app.enableCors({
    origin: webOrigins(config),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "Idempotency-Key",
      "X-Client",
      "X-Request-Id",
    ],
    exposedHeaders: ["X-Request-Id"],
    maxAge: 86400,
  });

  app.setGlobalPrefix("api", { exclude: ["health"] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.enableShutdownHooks();

  if (!production) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("Ads Autopilot API")
        .setVersion("1.0.0")
        .addBearerAuth()
        .addCookieAuth("access_token")
        .build(),
    );
    SwaggerModule.setup("api/docs", app, document);
  }

  return app;
}
