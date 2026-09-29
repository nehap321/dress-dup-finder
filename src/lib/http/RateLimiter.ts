import { AppConfig } from "../config/AppConfig";

export class RateLimiter {
  private static nextAt = new Map<string, number>();

  static async pace(hostname: string): Promise<void> {
    await RateLimiter.wait("global", AppConfig.globalRateLimitMs());
    await RateLimiter.wait(hostname.toLowerCase(), AppConfig.rateLimitMs());
  }

  private static async wait(bucket: string, gapMs: number): Promise<void> {
    const gap = Number.isFinite(gapMs) && gapMs > 0 ? gapMs : 0;
    if (gap === 0) return;
    const now = Date.now();
    const readyAt = RateLimiter.nextAt.get(bucket) ?? now;
    const start = Math.max(now, readyAt);
    RateLimiter.nextAt.set(bucket, start + gap);
    const delay = start - now;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
