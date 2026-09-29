import type { PageTransport } from "../http/PageTransport";
import { SafeFetch } from "../http/SafeFetch";
import type { MatchFilters } from "../search/SearchQuery";
import { StyleQuery } from "../search/StyleQuery";
import { DepopStyleSearch } from "./DepopStyleSearch";
import { EbayIndexSearch } from "./EbayIndexSearch";
import type { MarketplaceSearchResult } from "./Listing";
import { PoshmarkSearch } from "./PoshmarkSearch";

export class StyleBrowse {
  static async search(
    rawQuery: string,
    filters: MatchFilters,
    transport: PageTransport = SafeFetch,
  ): Promise<MarketplaceSearchResult[]> {
    const text = StyleQuery.text(rawQuery);
    return [
      await DepopStyleSearch.search(text, filters, transport),
      await PoshmarkSearch.search(text, filters, transport),
      await EbayIndexSearch.search(text, filters, transport),
    ];
  }
}
