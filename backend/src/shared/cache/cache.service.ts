import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";

import { REDIS } from "./redis";

@Injectable()
export class CacheService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.redis.del(...keys);
  }

  async delPattern(pattern: string): Promise<void> {
    let cursor = "0";
    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        200,
      );
      cursor = next;
      if (keys.length) await this.redis.del(...keys);
    } while (cursor !== "0");
  }

  async wrap<T>(
    key: string,
    ttlSeconds: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await load();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}
