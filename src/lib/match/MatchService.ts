import { ProductFetcher } from "../product/ProductFetcher";
import { ProductFetchError } from "../product/ProductFetchError";
import type { ProductInfo } from "../product/ProductInfo";
import { MarketplaceRegistry } from "../marketplaces/MarketplaceRegistry";
import type { MarketplaceSearchResult } from "../marketplaces/Listing";

export type MatchErrorCode = "invalid_url" | "fetch_failed" | "not_a_product" | "invalid_input";

export type MatchResponse =
  | {
      ok: true;
      product: ProductInfo;
      results: MarketplaceSearchResult[];
    }
  | {
      ok: false;
      error: { code: MatchErrorCode; message: string };
    };

export class MatchService {
  static async match(input: unknown): Promise<MatchResponse> {
    const parsed = MatchService.readInput(input);
    if (!parsed.valid) return { ok: false, error: parsed.error };
    try {
      const product = await ProductFetcher.fetch(parsed.url);
      const filters = {
        size: parsed.size,
        color: parsed.color,
        maxPrice: parsed.maxPrice,
      };
      const results: MarketplaceSearchResult[] = [];
      for (const provider of MarketplaceRegistry.providers()) {
        results.push(await provider.search(product, filters));
      }
      return { ok: true, product, results };
    } catch (error) {
      if (error instanceof ProductFetchError) {
        return { ok: false, error: { code: error.code, message: error.message } };
      }
      return {
        ok: false,
        error: { code: "fetch_failed", message: "Something went wrong while looking up that dress." },
      };
    }
  }

  private static readInput(input: unknown): {
    valid: true;
    url: string;
    size: string | null;
    color: string | null;
    maxPrice: number | null;
  } | {
    valid: false;
    error: { code: MatchErrorCode; message: string };
  } {
    if (!input || typeof input !== "object") {
      return { valid: false, error: { code: "invalid_input", message: "Send a product URL to search." } };
    }
    const body = input as Record<string, unknown>;
    if (typeof body.url !== "string" || !body.url.trim()) {
      return { valid: false, error: { code: "invalid_input", message: "Paste a product URL." } };
    }
    if (body.url.trim().length > 2000) {
      return { valid: false, error: { code: "invalid_input", message: "That URL is too long." } };
    }
    const size = MatchService.optionalText(body.size, 40, "Size");
    if (size instanceof Error) {
      return { valid: false, error: { code: "invalid_input", message: size.message } };
    }
    const color = MatchService.optionalText(body.color, 60, "Color");
    if (color instanceof Error) {
      return { valid: false, error: { code: "invalid_input", message: color.message } };
    }
    const maxPrice = MatchService.optionalPrice(body.maxPrice);
    if (maxPrice instanceof Error) {
      return { valid: false, error: { code: "invalid_input", message: maxPrice.message } };
    }
    return { valid: true, url: body.url.trim(), size, color, maxPrice };
  }

  private static optionalText(value: unknown, max: number, label: string): string | null | Error {
    if (value == null || value === "") return null;
    if (typeof value !== "string") return new Error(`${label} should be text.`);
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > max) return new Error(`${label} is too long.`);
    return trimmed;
  }

  private static optionalPrice(value: unknown): number | null | Error {
    if (value == null || value === "") return null;
    const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isFinite(number) || number < 0 || number > 100_000) {
      return new Error("Max price needs to be a number from 0 to 100000.");
    }
    return number;
  }
}
