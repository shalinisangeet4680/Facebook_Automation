import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const auth = req.auth as { userId?: string } | undefined;
    const ip = typeof req.ip === "string" ? req.ip : "unknown";
    return Promise.resolve(auth?.userId ? `user:${auth.userId}` : `ip:${ip}`);
  }
}
