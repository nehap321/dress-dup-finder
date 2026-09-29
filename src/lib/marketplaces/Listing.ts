import type { Money } from "../product/ProductInfo";

export type Listing = {
  marketplace: string;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  price: Money | null;
  size: string | null;
  brand: string | null;
  source: string | null;
};

export type MarketplaceSearchResult = {
  marketplace: string;
  label: string;
  mode: "listings" | "unavailable";
  matchKind: "visual" | "keyword";
  listings: Listing[];
  searchUrl: string;
  broaderSearchUrl: string;
  query: string;
  broaderQuery: string;
  currency: string | null;
  notice: string;
};
