import type { Listing } from "../marketplaces/Listing";
import type { MatchFilters } from "./SearchQuery";

const COLORS = ["black", "white", "grey", "gray", "blue", "navy", "red", "pink", "purple", "green", "yellow", "orange", "brown", "cream", "gold", "silver", "wine"];

export class ListingGuard {
  static hasPriceAndPhoto(listing: Listing): boolean {
    return Boolean(listing.thumbnailUrl && listing.price && Number.isFinite(listing.price.amount) && listing.price.amount >= 0);
  }

  static allows(listing: Listing, filters: MatchFilters): boolean {
    if (!ListingGuard.hasPriceAndPhoto(listing)) return false;
    if (ListingGuard.colorConflicts(listing.title, filters.color)) return false;
    if (ListingGuard.sizeConflicts(listing.title, listing.size, filters.size)) return false;
    if (ListingGuard.overBudget(listing, filters.maxPrice)) return false;
    return true;
  }

  private static colorConflicts(title: string, wanted: string | null): boolean {
    if (!wanted) return false;
    const wantedColors = ListingGuard.colorsIn(wanted);
    if (wantedColors.length === 0) return false;
    const titleColors = ListingGuard.colorsIn(title);
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

  private static sizeConflicts(title: string, stated: string | null, wanted: string | null): boolean {
    if (!wanted) return false;
    const wantedLetter = ListingGuard.letter(wanted);
    if (!wantedLetter) return false;
    const fromField = stated ? ListingGuard.letter(stated) : null;
    const fromTitle = title.toLowerCase().match(/\b(?:size|sz)\s*(xxs|xs|s|m|l|xl|xxl|xxxl)\b/)?.[1] ?? null;
    const statedLetter = fromField ?? fromTitle;
    return Boolean(statedLetter && statedLetter !== wantedLetter);
  }

  private static letter(value: string): string | null {
    const match = value.toLowerCase().match(/\b(xxs|xs|s|m|l|xl|xxl|xxxl|small|medium|large)\b/);
    if (!match?.[1]) return null;
    return match[1].replace("small", "s").replace("medium", "m").replace("large", "l");
  }

  private static overBudget(listing: Listing, maxPrice: number | null): boolean {
    if (maxPrice == null || !listing.price) return false;
    if (listing.price.currency && listing.price.currency !== "USD") return false;
    return listing.price.amount > maxPrice;
  }
}
