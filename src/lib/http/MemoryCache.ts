import type { FetchedPage } from "./PageTransport";

type CacheEntry = {
  expires: number;
  page: FetchedPage;
};

export class MemoryCache {
  private static entries = new Map<string, CacheEntry>();
  private static readonly maxEntries = 40;
  private static readonly maxChars = 250_000;

  static get(key: string): FetchedPage | null {
    const entry = MemoryCache.entries.get(key);
    if (!entry) return null;
    if (entry.expires < Date.now()) {
      MemoryCache.entries.delete(key);
      return null;
    }
    return entry.page;
  }

  static set(key: string, page: FetchedPage, ttlMs: number): void {
    if (page.body.length > MemoryCache.maxChars || ttlMs <= 0) return;
    MemoryCache.entries.delete(key);
    MemoryCache.entries.set(key, { expires: Date.now() + ttlMs, page });
    while (MemoryCache.entries.size > MemoryCache.maxEntries) {
      const oldest = MemoryCache.entries.keys().next().value;
      if (oldest === undefined) break;
      MemoryCache.entries.delete(oldest);
    }
  }
}
