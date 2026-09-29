import { AppConfig } from "../config/AppConfig";
import type { PageTransport } from "../http/PageTransport";
import { SafeFetch } from "../http/SafeFetch";
import { ListingGuard } from "../search/ListingGuard";
import { ListingOrder } from "../search/ListingOrder";
import type { BuiltSearch, MatchFilters } from "../search/SearchQuery";
import { StyleQuery } from "../search/StyleQuery";
import { DepopFilters } from "./DepopFilters";
import { DepopPageParser } from "./DepopPageParser";
import { DepopSearchLink } from "./DepopSearchLink";
import type { MarketplaceSearchResult } from "./Listing";

const BLOCKED =
  "Depop refused the search (HTTP 403). Shopper search isn't a public API, and this app does not invent Depop listings. Open Depop yourself if you want to look there.";

export class DepopStyleSearch {
  static readonly id = "depop";
  static readonly label = "Depop";

  static async search(
    text: string,
    filters: MatchFilters,
    transport: PageTransport = SafeFetch,
  ): Promise<MarketplaceSearchResult> {
    const built: BuiltSearch = {
      text,
      broaderText: text,
      color: null,
      size: filters.size,
      maxPrice: filters.maxPrice,
    };
    const searchUrl = DepopSearchLink.specific(built);
    const base = {
      marketplace: DepopStyleSearch.id,
      label: DepopStyleSearch.label,
      matchKind: "keyword" as const,
      searchUrl,
      broaderSearchUrl: DepopSearchLink.broader(built),
      query: text,
      broaderQuery: text,
      currency: DepopFilters.currencyForCountry(AppConfig.depopCountry()),
    };
    try {
      const page = await transport.get(searchUrl);
      const parsed = DepopPageParser.parse(page.status, page.body);
      if (parsed.blocked) return { ...base, mode: "unavailable", listings: [], notice: BLOCKED };
      const words = StyleQuery.words(text);
      const listings = ListingOrder.byLookAndPrice(
        parsed.listings.filter((listing) => StyleQuery.relevant(listing.title, words) && ListingGuard.allows(listing, filters)),
        words,
      ).slice(0, 8);
      return {
        ...base,
        mode: "listings",
        listings,
        notice:
          listings.length > 0
            ? "Depop listings read from the public search page. Each card has that listing's photo and price."
            : "Depop's search page had no dresses with both a photo and a price for those words.",
      };
    } catch {
      return { ...base, mode: "unavailable", listings: [], notice: BLOCKED };
    }
  }
}
