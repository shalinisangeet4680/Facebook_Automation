import "./instrument";

import { ConfigService } from "@nestjs/config";
import { Logger } from "nestjs-pino";

import { AppConfig } from "@shared/config/app-config";

import { createApp } from "./app.factory";

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const port = app.get<AppConfig>(ConfigService).get("PORT", { infer: true });
  await app.listen(port, "0.0.0.0");
  app.get(Logger).log(`API listening on :${port}`, "Bootstrap");
}

void bootstrap();
