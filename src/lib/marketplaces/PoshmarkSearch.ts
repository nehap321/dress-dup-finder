import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CurlPage } from "../http/CurlPage";
import type { PageTransport } from "../http/PageTransport";
import { SafeFetch } from "../http/SafeFetch";
import { JsonValue } from "../product/JsonValue";
import { TextFormat } from "../product/TextFormat";
import { ListingGuard } from "../search/ListingGuard";
import { ListingOrder } from "../search/ListingOrder";
import type { MatchFilters } from "../search/SearchQuery";
import { StyleQuery } from "../search/StyleQuery";
import type { Listing, MarketplaceSearchResult } from "./Listing";

const BLOCKED =
  "Poshmark didn't return a listing feed, so there are no Poshmark cards. Nothing was invented.";

export class PoshmarkSearch {
  static readonly id = "poshmark";
  static readonly label = "Poshmark";

  static apiUrl(query: string): string {
    const url = new URL("https://poshmark.com/vm-rest/posts");
    url.searchParams.set(
      "request",
      JSON.stringify({
        query,
        filters: { inventory_status: ["available"] },
        sort_by: "price_asc",
        count: "24",
        experience: "all",
      }),
    );
    return url.toString();
  }

  static async search(
    text: string,
    filters: MatchFilters,
    transport: PageTransport = SafeFetch,
  ): Promise<MarketplaceSearchResult> {
    const words = StyleQuery.words(text);
    const searchUrl = `https://poshmark.com/search?query=${encodeURIComponent(text)}&type=listings`;
    const base = PoshmarkSearch.shell(searchUrl, text);
    try {
      const page = transport === SafeFetch ? await PoshmarkSearch.live(text) : await transport.get(PoshmarkSearch.apiUrl(text));
      if (page.status >= 400) return { ...base, mode: "unavailable", listings: [], notice: BLOCKED };
      const listings = ListingOrder.byLookAndPrice(PoshmarkSearch.keep(PoshmarkSearch.parse(page.body), words, filters), words).slice(0, 8);
      return {
        ...base,
        mode: "listings",
        listings,
        notice:
          listings.length > 0
            ? "Poshmark listings from the public search feed. Each card uses that listing's photo and price. Cheaper, closer title matches come first."
            : "Poshmark returned no dresses with both a photo and a price for those words.",
      };
    } catch {
      return { ...base, mode: "unavailable", listings: [], notice: BLOCKED };
    }
  }

  static parse(body: string): Listing[] {
    let data: unknown;
    try {
      data = JSON.parse(body) as unknown;
    } catch {
      return [];
    }
    const items = JsonValue.record(data)?.data;
    if (!Array.isArray(items)) return [];
    const listings: Listing[] = [];
    for (const item of items) {
      const record = JsonValue.record(item);
      if (!record) continue;
      const title = TextFormat.cleanLine(JsonValue.string(record.title) ?? "");
      const id = JsonValue.string(record.id);
      const price = JsonValue.record(record.price_amount);
      const amount = price ? Number(JsonValue.string(price.val) ?? price.val) : NaN;
      const cover = JsonValue.record(record.cover_shot);
      const photo = cover ? JsonValue.string(cover.url_small) ?? JsonValue.string(cover.url) : null;
      if (!title || !id || !photo || !Number.isFinite(amount)) continue;
      const currency = price ? JsonValue.string(price.currency_code) : null;
      listings.push({
        marketplace: PoshmarkSearch.id,
        title,
        url: PoshmarkSearch.listingUrl(title, id),
        thumbnailUrl: photo,
        price: { amount, currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : "USD" },
        size: PoshmarkSearch.sizeOf(record),
        brand: null,
        source: "poshmark.com",
      });
    }
    return listings;
  }

  private static async live(text: string) {
    const dir = await mkdtemp(join(tmpdir(), "dressdup-posh-"));
    const jar = join(dir, "cookies");
    try {
      await CurlPage.get("https://poshmark.com/", jar);
      return await CurlPage.get(PoshmarkSearch.apiUrl(text), jar);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private static keep(listings: Listing[], words: string[], filters: MatchFilters): Listing[] {
    return listings.filter((listing) => StyleQuery.relevant(listing.title, words) && ListingGuard.allows(listing, filters));
  }

  private static sizeOf(record: Record<string, unknown>): string | null {
    const inventory = JsonValue.record(record.inventory);
    const quantities = inventory && Array.isArray(inventory.size_quantities) ? inventory.size_quantities : [];
    const first = JsonValue.record(quantities[0]);
    const size = first ? JsonValue.record(first.size_obj) : null;
    const display = size ? JsonValue.string(size.display_with_size_system) ?? JsonValue.string(size.display) : null;
    return display ? TextFormat.cleanLine(display) : null;
  }

  private static listingUrl(title: string, id: string): string {
    const slug = title
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `https://poshmark.com/listing/${slug}-${id}`;
  }

  private static shell(searchUrl: string, text: string): Omit<MarketplaceSearchResult, "mode" | "listings" | "notice"> {
    return {
      marketplace: PoshmarkSearch.id,
      label: PoshmarkSearch.label,
      matchKind: "keyword",
      searchUrl,
      broaderSearchUrl: searchUrl,
      query: text,
      broaderQuery: text,
      currency: "USD",
    };
  }
}
