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

    let text = title;
    if (brand && !SearchQuery.contains(text, brand)) text = `${brand} ${text}`;
    if (color && !SearchQuery.contains(text, color)) text = `${text} ${color}`;

    let broader = brand ? `${brand} dress` : SearchQuery.fallbackBroader(title);
    if (color && !SearchQuery.contains(broader, color)) broader = `${broader} ${color}`;

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

  private static fallbackBroader(title: string): string {
    const words = title.split(/\s+/).filter(Boolean).slice(0, 4).join(" ");
    if (!words) return "dress";
    return /dress/i.test(words) ? words : `${words} dress`;
  }
}
