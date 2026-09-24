export class AppConfig {
  static rateLimitMs(): number {
    return AppConfig.readNumber("RATE_LIMIT_MS", 1500);
  }

  static globalRateLimitMs(): number {
    return AppConfig.readNumber("GLOBAL_RATE_LIMIT_MS", 400);
  }

  static fetchTimeoutMs(): number {
    return AppConfig.readNumber("FETCH_TIMEOUT_MS", 8000);
  }

  static cacheTtlMs(): number {
    return AppConfig.readNumber("CACHE_TTL_MS", 600_000);
  }

  static maxListings(): number {
    return Math.min(24, Math.max(1, Math.floor(AppConfig.readNumber("MAX_LISTINGS", 12))));
  }

  static maxBytes(): number {
    return 3_000_000;
  }

  static depopCountry(): string {
    const raw = (process.env.DEPOP_COUNTRY ?? "us").trim().toLowerCase();
    const allowed = new Set(["us", "uk", "au", "eu", "de", "fr", "it"]);
    return allowed.has(raw) ? raw : "us";
  }

  static userAgent(): string {
    return "DressDupFinder/1.0 (+https://github.com/nehap321/dress-dup-finder; personal shopping lookup)";
  }

  private static readNumber(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }
}
