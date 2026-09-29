import { CurlPage } from "../http/CurlPage";
import type { PageTransport } from "../http/PageTransport";
import { SafeFetch } from "../http/SafeFetch";
import { TextFormat } from "../product/TextFormat";
import { ListingGuard } from "../search/ListingGuard";
import { ListingOrder } from "../search/ListingOrder";
import type { MatchFilters } from "../search/SearchQuery";
import { StyleQuery } from "../search/StyleQuery";
import type { Listing, MarketplaceSearchResult } from "./Listing";

const BLOCKED =
  "eBay's own search returned HTTP 403 from this server, and the public eBay index didn't include a photo and price. No eBay cards were invented.";

export class EbayIndexSearch {
  static readonly id = "ebay";
  static readonly label = "eBay";

  static pageUrl(query: string): string {
    const url = new URL("https://picclick.com/");
    url.searchParams.set("q", query);
    return url.toString();
  }

  static async search(
    text: string,
    filters: MatchFilters,
    transport: PageTransport = SafeFetch,
  ): Promise<MarketplaceSearchResult> {
    const words = StyleQuery.words(text);
    const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(text)}&LH_BIN=1&_sop=15`;
    const base = {
      marketplace: EbayIndexSearch.id,
      label: EbayIndexSearch.label,
      matchKind: "keyword" as const,
      searchUrl,
      broaderSearchUrl: searchUrl,
      query: text,
      broaderQuery: text,
      currency: "USD",
    };
    try {
      const direct = transport === SafeFetch ? await CurlPage.get(searchUrl) : await transport.get(searchUrl);
      if (direct.status < 400 && !/error page \| ebay/i.test(direct.body.slice(0, 500))) {
        const native = EbayIndexSearch.parseEbay(direct.body);
        const listings = ListingOrder.byLookAndPrice(EbayIndexSearch.keep(native, words, filters), words).slice(0, 8);
        if (listings.length > 0) {
          return {
            ...base,
            mode: "listings",
            listings,
            notice: "eBay listings from eBay search. Each card has that listing's photo and price.",
          };
        }
      }
      const indexUrl = EbayIndexSearch.pageUrl(text);
      const index = transport === SafeFetch ? await CurlPage.get(indexUrl) : await transport.get(indexUrl);
      if (index.status >= 400) return { ...base, mode: "unavailable", listings: [], notice: BLOCKED };
      const listings = ListingOrder.byLookAndPrice(
        EbayIndexSearch.keep(EbayIndexSearch.parseIndex(index.body), words, filters),
        words,
      ).slice(0, 8);
      return {
        ...base,
        mode: listings.length > 0 ? "listings" : "unavailable",
        listings,
        notice:
          listings.length > 0
            ? "eBay's search page returned HTTP 403 here, so these are eBay item numbers, photos, and prices from PicClick's public eBay index. The link opens the eBay listing. Cheaper, closer title matches come first."
            : BLOCKED,
      };
    } catch {
      return { ...base, mode: "unavailable", listings: [], notice: BLOCKED };
    }
  }

  static parseIndex(html: string): Listing[] {
    const listings: Listing[] = [];
    for (const match of html.matchAll(/<li id="item-(\d+)"[\s\S]*?(?=<li id="item-|<\/ul>)/g)) {
      const block = match[0] ?? "";
      const id = match[1];
      if (!id || !/See on eBay|Buy It Now/i.test(block)) continue;
      const photo = block.match(/src="(https:\/\/www\.picclickimg\.com\/[^"]+)"/)?.[1];
      const titleRaw = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? "";
      const title = TextFormat.cleanLine(titleRaw);
      const amount = Number(block.match(/class="price"[\s\S]*?<strong>\s*\$(\d+(?:\.\d{2})?)/)?.[1]);
      if (!photo || !title || !Number.isFinite(amount)) continue;
      listings.push({
        marketplace: EbayIndexSearch.id,
        title,
        url: `https://www.ebay.com/itm/${id}`,
        thumbnailUrl: photo,
        price: { amount, currency: "USD" },
        size: null,
        brand: null,
        source: "ebay.com",
      });
    }
    return listings;
  }

  static parseEbay(html: string): Listing[] {
    const listings: Listing[] = [];
    for (const match of html.matchAll(/href="(https:\/\/www\.ebay\.com\/itm\/(\d+)[^"]*)"/g)) {
      const url = match[1];
      const id = match[2];
      if (!url || !id || listings.some((listing) => listing.url.includes(id))) continue;
      listings.push({
        marketplace: EbayIndexSearch.id,
        title: `eBay item ${id}`,
        url: url.split("?")[0] ?? url,
        thumbnailUrl: null,
        price: null,
        size: null,
        brand: null,
        source: "ebay.com",
      });
    }
    return listings.filter((listing) => ListingGuard.hasPriceAndPhoto(listing));
  }

  private static keep(listings: Listing[], words: string[], filters: MatchFilters): Listing[] {
    return listings.filter((listing) => StyleQuery.relevant(listing.title, words) && ListingGuard.allows(listing, filters));
  }
}
