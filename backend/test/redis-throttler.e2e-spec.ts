import Redis from "ioredis";

import { RedisThrottlerStorage } from "@shared/security/redis-throttler.storage";

describe("RedisThrottlerStorage", () => {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  const storage = new RedisThrottlerStorage(redis);
  const key = `spec-${Date.now()}`;

  afterAll(async () => {
    const keys = await redis.keys(`throttle:spec:${key}*`);
    if (keys.length) await redis.del(...keys);
    await redis.quit();
  });

  it("counts hits and blocks after the limit", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await storage.increment(key, 60_000, 3, 5_000, "spec"));
    }
    expect(results.slice(0, 3).map((r) => r.isBlocked)).toEqual([
      false,
      false,
      false,
    ]);
    expect(results[3]!.isBlocked).toBe(true);
    expect(results[3]!.timeToBlockExpire).toBeGreaterThan(0);
  });

  it("stays blocked while the block window is active", async () => {
    const next = await storage.increment(key, 60_000, 3, 5_000, "spec");
    expect(next.isBlocked).toBe(true);
  });
});
