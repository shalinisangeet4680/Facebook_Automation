import { randomUUID } from "node:crypto";

import Redis from "ioredis";

const SCRIPT = `
local key = KEYS[1]
local time = redis.call("TIME")
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
redis.call("ZREMRANGEBYSCORE", key, 0, now - window)
if redis.call("ZCARD", key) < limit then
  redis.call("ZADD", key, now, ARGV[3])
  redis.call("PEXPIRE", key, window)
  return 0
end
local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
return math.max(1, tonumber(oldest[2]) + window - now)
`;

const MAX_WAIT_MS = 2 * 60_000;

export class RateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly prefix: string,
    private readonly limit: number,
    private readonly windowMs = 60_000,
  ) {}

  async acquire(bucket: string): Promise<void> {
    const key = `ratelimit:${this.prefix}:${bucket}`;
    const started = Date.now();
    for (;;) {
      const wait = Number(
        await this.redis.eval(
          SCRIPT,
          1,
          key,
          this.windowMs,
          this.limit,
          randomUUID(),
        ),
      );
      if (wait === 0) return;
      if (Date.now() - started + wait > MAX_WAIT_MS)
        throw new Error(`Rate limit for ${this.prefix}:${bucket} is saturated`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}
