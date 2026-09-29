import type { ProductInfo } from "../product/ProductInfo";
import { TextFormat } from "../product/TextFormat";

export type MatchFilters = {
  size: string | null;
  color: string | null;
  maxPrice: number | null;
};

export type BuiltSearch = {
  text: string;
  broaderText: string;
  color: string | null;
  size: string | null;
  maxPrice: number | null;
};

export class SearchQuery {
  static build(product: ProductInfo, filters: MatchFilters): BuiltSearch {
    const brand = TextFormat.cleanLine(product.brand ?? "");
    const title = TextFormat.cleanLine(product.title);
    const color = TextFormat.cleanLine(filters.color || product.color || "");
    const size = TextFormat.cleanLine(filters.size ?? "");

    let text = brand ? SearchQuery.removePhrase(title, brand) : title;
    if (color && !SearchQuery.contains(text, color)) text = `${text} ${color}`;
    if (!/dress/i.test(text)) text = `${text} dress`;

    const broader = SearchQuery.styleBroader(text, color);

    return {
      text: text.replace(/\s+/g, " ").trim(),
      broaderText: broader.replace(/\s+/g, " ").trim(),
      color: color || null,
      size: size || null,
      maxPrice: filters.maxPrice,
    };
  }

  private static contains(haystack: string, needle: string): boolean {
    if (/[\s/]/.test(needle)) return haystack.toLowerCase().includes(needle.toLowerCase());
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(haystack);
  }

  private static removePhrase(text: string, phrase: string): string {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.replace(new RegExp(`(?:^|\\s)${escaped}(?=\\s|$)`, "ig"), " ").replace(/\s+/g, " ").trim();
  }

  private static styleBroader(text: string, color: string): string {
    const lower = text.toLowerCase();
    const tokens = ["slit", "polka", "midi", "mini", "maxi", "slip", "cowl", "halter", "satin", "lace", "strapless"];
    const found = tokens.filter((token) => lower.includes(token)).slice(0, 3);
    const parts = found.length > 0 ? [...found, "dress"] : ["dress"];
    if (color && !SearchQuery.contains(parts.join(" "), color)) parts.push(color);
    return parts.join(" ");
  }
}
