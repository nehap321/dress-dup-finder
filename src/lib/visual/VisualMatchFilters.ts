import type { Listing } from "../marketplaces/Listing";
import type { ProductInfo } from "../product/ProductInfo";
import type { MatchFilters } from "../search/SearchQuery";

const COLORS = [
  "black",
  "white",
  "grey",
  "gray",
  "blue",
  "navy",
  "red",
  "pink",
  "purple",
  "green",
  "yellow",
  "orange",
  "brown",
  "cream",
  "gold",
  "silver",
];

export class VisualMatchFilters {
  static apply(listings: Listing[], filters: MatchFilters, product: ProductInfo): Listing[] {
    const seen = new Set<string>();
    const kept: Listing[] = [];
    for (const listing of listings) {
      const key = listing.url.split("?")[0] ?? listing.url;
      if (seen.has(key)) continue;
      if (VisualMatchFilters.sameProduct(listing.url, product.sourceUrl)) continue;
      if (VisualMatchFilters.colorConflicts(listing.title, filters.color)) continue;
      if (VisualMatchFilters.sizeConflicts(listing.title, filters.size)) continue;
      if (VisualMatchFilters.overBudget(listing, filters.maxPrice)) continue;
      seen.add(key);
      kept.push(listing);
      if (kept.length >= 8) break;
    }
    return kept;
  }

  private static sameProduct(listingUrl: string, sourceUrl: string): boolean {
    try {
      const listing = new URL(listingUrl);
      const source = new URL(sourceUrl);
      const sourceHandle = source.pathname.split("/").filter(Boolean).pop() ?? "";
      return Boolean(sourceHandle) && listing.pathname.includes(sourceHandle);
    } catch {
      return false;
    }
  }

  private static colorConflicts(title: string, wanted: string | null): boolean {
    if (!wanted) return false;
    const wantedColors = VisualMatchFilters.colorsIn(wanted);
    if (wantedColors.length === 0) return false;
    const titleColors = VisualMatchFilters.colorsIn(title);
    if (titleColors.length === 0) return false;
    return !wantedColors.some((color) => titleColors.includes(color));
  }

  private static colorsIn(value: string): string[] {
    const tokens = value.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    const found: string[] = [];
    for (const token of tokens) {
      const color = token === "gray" ? "grey" : token;
      if (COLORS.includes(token) && !found.includes(color)) found.push(color);
    }
    return found;
  }

  private static sizeConflicts(title: string, wanted: string | null): boolean {
    if (!wanted) return false;
    const wantedLetter = wanted.trim().toLowerCase().match(/^(xxs|xs|s|m|l|xl|xxl|xxxl|small|medium|large)$/);
    const titleLetter = title.toLowerCase().match(/\b(?:size|sz)\s*(xxs|xs|s|m|l|xl|xxl|xxxl)\b/);
    if (wantedLetter?.[1] && titleLetter?.[1]) {
      const normalized = wantedLetter[1].replace("small", "s").replace("medium", "m").replace("large", "l");
      if (normalized !== titleLetter[1]) return true;
    }
    const wantedNumber = wanted.match(/\b(?:us\s*)?(\d{1,2})\b/i);
    const titleNumber = title.match(/\bsize\s*(?:us\s*)?(\d{1,2})\b/i);
    if (wanted.match(/us/i) && wantedNumber?.[1] && titleNumber?.[1] && wantedNumber[1] !== titleNumber[1]) {
      return true;
    }
    return false;
  }

  private static overBudget(listing: Listing, maxPrice: number | null): boolean {
    if (maxPrice == null || !listing.price) return false;
    if (listing.price.currency && listing.price.currency !== "USD") return false;
    return listing.price.amount > maxPrice;
  }
}
