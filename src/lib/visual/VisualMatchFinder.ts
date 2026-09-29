import type { PageTransport } from "../http/PageTransport";
import { SafeFetch } from "../http/SafeFetch";
import type { Listing, MarketplaceSearchResult } from "../marketplaces/Listing";
import { DepopSearchLink } from "../marketplaces/DepopSearchLink";
import type { ProductInfo } from "../product/ProductInfo";
import type { MatchFilters } from "../search/SearchQuery";
import { SearchQuery } from "../search/SearchQuery";
import { GoogleLensSearch } from "./GoogleLensSearch";
import { VisualMatchFilters } from "./VisualMatchFilters";
import { YandexVisualSearch } from "./YandexVisualSearch";

const LENS_NOTICE =
  "Matched from the dress photo with Google Lens. Results are ordered by visual similarity. Size, color, and max price only drop a result when that listing states a conflicting value. The brand name is not the search.";

const YANDEX_NOTICE =
  "Matched from the dress photo with Yandex Images reverse search, then kept only when a real product page was attached. Order follows how similar the photo looks. The brand name is not the search.";

const EMPTY_NOTICE =
  "The reverse-image search didn't return a product page that looks like this dress. No listings were invented.";

const FAIL_NOTICE =
  "The visual search didn't respond, so there are no lookalike listings to show. No listings were invented.";

const NO_PHOTO_NOTICE = "That product page had no photo, so the dress can't be matched by how it looks.";

export class VisualMatchFinder {
  static readonly id = "visual";
  static readonly label = "Similar look";

  static async search(
    product: ProductInfo,
    filters: MatchFilters,
    transport: PageTransport = SafeFetch,
  ): Promise<MarketplaceSearchResult> {
    const query = SearchQuery.build(product, filters);
    const base = {
      marketplace: VisualMatchFinder.id,
      label: VisualMatchFinder.label,
      matchKind: "visual" as const,
      searchUrl: DepopSearchLink.specific(query),
      broaderSearchUrl: DepopSearchLink.broader(query),
      query: query.text,
      broaderQuery: query.broaderText,
      currency: "USD",
    };
    const image = product.images[0];
    if (!image) {
      return { ...base, mode: "unavailable", listings: [], notice: NO_PHOTO_NOTICE };
    }
    try {
      if (GoogleLensSearch.isConfigured()) {
        try {
          const lens = await GoogleLensSearch.search(image, transport);
          const filtered = VisualMatchFilters.apply(lens, filters, product);
          if (filtered.length > 0) {
            return { ...base, mode: "listings", listings: filtered, notice: LENS_NOTICE };
          }
        } catch {
          // A Lens failure still leaves the public reverse-image search.
        }
      }
      const looked = await YandexVisualSearch.listings(image, transport);
      const listings = VisualMatchFinder.dropOriginal(looked, product);
      const filtered = VisualMatchFilters.apply(listings, filters, product);
      return {
        ...base,
        mode: "listings",
        listings: filtered,
        notice: filtered.length > 0 ? YANDEX_NOTICE : EMPTY_NOTICE,
      };
    } catch {
      return { ...base, mode: "unavailable", listings: [], notice: FAIL_NOTICE };
    }
  }

  private static dropOriginal(listings: Listing[], product: ProductInfo): Listing[] {
    return listings.filter((listing) => listing.url !== product.sourceUrl);
  }
}
