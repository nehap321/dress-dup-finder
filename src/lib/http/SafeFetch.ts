import { AppConfig } from "../config/AppConfig";
import { AddressPolicy } from "./AddressPolicy";
import { MemoryCache } from "./MemoryCache";
import type { FetchedPage } from "./PageTransport";
import { RateLimiter } from "./RateLimiter";
import { SafeFetchError } from "./SafeFetchError";

export class SafeFetch {
  static async get(rawUrl: string): Promise<FetchedPage> {
    let current = AddressPolicy.parse(rawUrl);
    try {
      for (let hop = 0; hop < 5; hop += 1) {
        AddressPolicy.rejectIfDisallowed(current);
        const cached = MemoryCache.get(current.toString());
        if (cached) return cached;

        await AddressPolicy.assertPublicDns(current.hostname);
        await RateLimiter.pace(current.hostname);

        const response = await fetch(current.toString(), {
          method: "GET",
          redirect: "manual",
          cache: "no-store",
          signal: AbortSignal.timeout(AppConfig.fetchTimeoutMs()),
          headers: {
            Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "User-Agent": AppConfig.userAgent(),
          },
        });

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) {
            throw new SafeFetchError(
              "The page redirected without a destination.",
              "fetch_failed",
              response.status,
            );
          }
          current = new URL(location, current);
          continue;
        }

        const advertised = Number(response.headers.get("content-length") ?? "0");
        if (Number.isFinite(advertised) && advertised > AppConfig.maxBytes()) {
          throw new SafeFetchError("That page is too large to read.", "fetch_failed", response.status);
        }

        const body = await SafeFetch.readBody(response, AppConfig.maxBytes());
        const page: FetchedPage = {
          url: current.toString(),
          status: response.status,
          body,
          contentType: response.headers.get("content-type") ?? "",
        };
        const challenged = /smartcaptcha|showcaptcha/i.test(body.slice(0, 5000));
        const ttl = challenged ? 0 : response.status === 200 ? AppConfig.cacheTtlMs() : response.status === 403 ? 60_000 : 0;
        if (ttl > 0) MemoryCache.set(current.toString(), page, ttl);
        return page;
      }
      throw new SafeFetchError("That page redirected too many times.", "fetch_failed");
    } catch (error) {
      if (error instanceof SafeFetchError) throw error;
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new SafeFetchError("The site took too long to respond.", "fetch_failed");
      }
      throw new SafeFetchError("Couldn't reach that site.", "fetch_failed");
    }
  }

  private static async readBody(response: Response, maxBytes: number): Promise<string> {
    if (!response.body) return "";
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        received += value.byteLength;
        if (received > maxBytes) {
          await reader.cancel();
          throw new SafeFetchError("That page is too large to read.", "fetch_failed");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const buffer = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  }
}
