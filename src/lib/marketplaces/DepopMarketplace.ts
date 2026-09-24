import { AppConfig } from "../config/AppConfig";
import type { PageTransport } from "../http/PageTransport";
import { SafeFetch } from "../http/SafeFetch";
import type { ProductInfo } from "../product/ProductInfo";
import type { MatchFilters } from "../search/SearchQuery";
import { SearchQuery } from "../search/SearchQuery";
import { DepopFilters } from "./DepopFilters";
import { DepopPageParser } from "./DepopPageParser";
import { DepopSearchLink } from "./DepopSearchLink";
import type { Listing, MarketplaceSearchResult } from "./Listing";

const EMPTY_NOTICE =
  "Depop's search page loaded, but it didn't include any listings for this query. Try the broader search, or loosen the size, color, or max price.";

const BLOCKED_NOTICE =
  "Depop refused the automated search. Shopper search isn't a public API, and this app does not bypass Depop's bot check or invent listings. Open the prefilled search to see live results.";

const UNREACHABLE_NOTICE =
  "Couldn't reach Depop from this server. Nothing here is a made-up listing. Open the prefilled search to check live results yourself.";

export class DepopMarketplace {
  static readonly id = "depop";
  static readonly label = "Depop";

  static async search(
    product: ProductInfo,
    filters: MatchFilters,
    transport: PageTransport = SafeFetch,
  ): Promise<MarketplaceSearchResult> {
    const query = SearchQuery.build(product, filters);
    const searchUrl = DepopSearchLink.specific(query);
    const broaderSearchUrl = DepopSearchLink.broader(query);
    const currency = DepopFilters.currencyForCountry(AppConfig.depopCountry());
    const base = {
      marketplace: DepopMarketplace.id,
      label: DepopMarketplace.label,
      searchUrl,
      broaderSearchUrl,
      query: query.text,
      broaderQuery: query.broaderText,
      currency,
    };

    try {
      const page = await transport.get(searchUrl);
      const parsed = DepopPageParser.parse(page.status, page.body);
      if (parsed.blocked) {
        return { ...base, mode: "unavailable", listings: [], notice: BLOCKED_NOTICE };
      }
      const listings = DepopMarketplace.present(parsed.listings, filters.maxPrice, currency);
      return {
        ...base,
        mode: "listings",
        listings,
        notice:
          listings.length > 0
            ? "These are real listings read from the Depop search page. Prices and stock change quickly."
            : EMPTY_NOTICE,
      };
    } catch {
      return { ...base, mode: "unavailable", listings: [], notice: UNREACHABLE_NOTICE };
    }
  }

  private static present(listings: Listing[], maxPrice: number | null, currency: string | null): Listing[] {
    const affordable = listings.filter((listing) => {
      if (maxPrice == null || !listing.price) return true;
      if (listing.price.currency && currency && listing.price.currency !== currency) return true;
      return listing.price.amount <= maxPrice;
    });
    affordable.sort((a, b) => {
      if (a.price && b.price) return a.price.amount - b.price.amount;
      if (a.price) return -1;
      if (b.price) return 1;
      return 0;
    });
    return affordable.slice(0, AppConfig.maxListings());
  }
}
