import type { PageTransport } from "../http/PageTransport";
import type { ProductInfo } from "../product/ProductInfo";
import type { MatchFilters } from "../search/SearchQuery";
import { DepopMarketplace } from "./DepopMarketplace";
import type { MarketplaceSearchResult } from "./Listing";

export type MarketplaceProvider = {
  id: string;
  label: string;
  search: (
    product: ProductInfo,
    filters: MatchFilters,
    transport?: PageTransport,
  ) => Promise<MarketplaceSearchResult>;
};

export class MarketplaceRegistry {
  static providers(): MarketplaceProvider[] {
    return [DepopMarketplace];
  }
}
