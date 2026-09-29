import type { PageTransport } from "../http/PageTransport";
import { SafeFetch } from "../http/SafeFetch";
import type { Listing, MarketplaceSearchResult } from "../marketplaces/Listing";
import { DepopSearchLink } from "../marketplaces/DepopSearchLink";
import type { ProductInfo } from "../product/ProductInfo";
import type { MatchFilters } from "../search/SearchQuery";
import { SearchQuery } from "../search/SearchQuery";
import { GoogleLensSearch } from "./GoogleLensSearch";
import { ListingPageProof } from "./ListingPageProof";
import { VisualMatchFilters } from "./VisualMatchFilters";
import { YandexVisualSearch } from "./YandexVisualSearch";

const EMPTY_NOTICE =
  "No page both showed this dress photo and stated a price. Pages that failed that check were left out. Nothing was invented.";

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
          const proved = await VisualMatchFinder.prove(lens, transport);
          const filtered = VisualMatchFilters.apply(proved.listings, filters, product);
          if (filtered.length > 0) {
            return { ...base, mode: "listings", listings: filtered, notice: VisualMatchFinder.notice(proved.omitted, "Google Lens") };
          }
        } catch {
          // A Lens failure still leaves the public reverse-image search.
        }
      }
      const looked = await YandexVisualSearch.listings(image, transport);
      const proved = await VisualMatchFinder.prove(VisualMatchFinder.dropOriginal(looked, product), transport);
      const filtered = VisualMatchFilters.apply(proved.listings, filters, product);
      return {
        ...base,
        mode: "listings",
        listings: filtered,
        notice: filtered.length > 0 ? VisualMatchFinder.notice(proved.omitted, "Yandex Images") : EMPTY_NOTICE,
      };
    } catch {
      return { ...base, mode: "unavailable", listings: [], notice: FAIL_NOTICE };
    }
  }

  private static async prove(
    listings: Listing[],
    transport: PageTransport,
  ): Promise<{ listings: Listing[]; omitted: number }> {
    const kept: Listing[] = [];
    let omitted = 0;
    for (const listing of listings) {
      const matched = listing.thumbnailUrl;
      if (!matched) {
        omitted += 1;
        continue;
      }
      const proved = await ListingPageProof.keep(listing, matched, transport);
      if (!proved?.thumbnailUrl || !proved.price) {
        omitted += 1;
        continue;
      }
      kept.push(proved);
      if (kept.length >= 6) break;
    }
    return { listings: kept, omitted };
  }

  private static notice(omitted: number, source: string): string {
    const dropped =
      omitted > 0
        ? ` ${omitted} other page${omitted === 1 ? "" : "s"} ${omitted === 1 ? "was" : "were"} left out because the dress photo or a price was not on that page.`
        : "";
    return `Matched from the dress photo with ${source}. A card is shown only when that listing page contains the matched photo and states a price.${dropped} The brand name is not the search.`;
  }

  private static dropOriginal(listings: Listing[], product: ProductInfo): Listing[] {
    return listings.filter((listing) => listing.url !== product.sourceUrl);
  }
}
