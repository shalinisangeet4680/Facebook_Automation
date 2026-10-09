import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createReadStream } from "fs";
import { mkdir, rm, stat, writeFile } from "fs/promises";
import { isAbsolute, join, resolve } from "path";

import { AppConfig } from "@shared/config/app-config";

import { MediaStorage } from "../domain/ports/media-storage";

const SAFE_KEY = /^[A-Za-z0-9._-]+$/;

@Injectable()
export class LocalMediaStorage implements MediaStorage {
  private readonly root: string;

  constructor(@Inject(ConfigService) config: AppConfig) {
    const dir = config.get("MEDIA_DIR", { infer: true });
    this.root = isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
  }

  async put(key: string, body: Buffer): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.path(key), body);
  }

  async read(key: string, range?: { start: number; end: number }) {
    if (!SAFE_KEY.test(key)) return null;
    try {
      const info = await stat(this.path(key));
      return {
        stream: createReadStream(this.path(key), range),
        size: info.size,
      };
    } catch {
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  private path(key: string): string {
    if (!SAFE_KEY.test(key)) throw new Error("Invalid media key");
    return join(this.root, key);
  }
}
