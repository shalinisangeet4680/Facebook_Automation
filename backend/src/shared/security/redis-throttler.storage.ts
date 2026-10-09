import { Inject, Injectable } from "@nestjs/common";
import { ThrottlerStorage } from "@nestjs/throttler";
import { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import Redis from "ioredis";

import { REDIS } from "@shared/cache/redis";

const SCRIPT = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local block = tonumber(ARGV[3])
local blockTtl = redis.call("PTTL", blockKey)
if blockTtl > 0 then
  return { limit + 1, redis.call("PTTL", hitsKey), 1, blockTtl }
end
local hits = redis.call("INCR", hitsKey)
if hits == 1 then redis.call("PEXPIRE", hitsKey, ttl) end
local hitsTtl = redis.call("PTTL", hitsKey)
if hits > limit then
  redis.call("SET", blockKey, 1, "PX", block)
  return { hits, hitsTtl, 1, block }
end
return { hits, hitsTtl, 0, 0 }
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const base = `throttle:${throttlerName}:${key}`;
    const [hits, hitsTtl, blocked, blockTtl] = (await this.redis.eval(
      SCRIPT,
      2,
      `${base}:hits`,
      `${base}:block`,
      ttl,
      limit,
      blockDuration > 0 ? blockDuration : ttl,
    )) as [number, number, number, number];
    return {
      totalHits: hits,
      timeToExpire: Math.max(0, Math.ceil(hitsTtl / 1000)),
      isBlocked: blocked === 1,
      timeToBlockExpire: Math.max(0, Math.ceil(blockTtl / 1000)),
    };
  }
}
