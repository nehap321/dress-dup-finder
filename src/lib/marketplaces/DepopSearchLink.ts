import { AppConfig } from "../config/AppConfig";
import { TextFormat } from "../product/TextFormat";
import type { BuiltSearch } from "../search/SearchQuery";
import { DepopFilters } from "./DepopFilters";

export class DepopSearchLink {
  static specific(query: BuiltSearch): string {
    return DepopSearchLink.build(query, "specific");
  }

  static broader(query: BuiltSearch): string {
    return DepopSearchLink.build(query, "broader");
  }

  private static build(query: BuiltSearch, kind: "specific" | "broader"): string {
    const country = AppConfig.depopCountry();
    const url = new URL(`https://www.depop.com/${country}/search/`);
    let text = kind === "specific" ? query.text : query.broaderText;
    if (kind === "specific" && query.size && !text.toLowerCase().includes(`size ${query.size.toLowerCase()}`)) {
      text = `${text} size ${query.size}`;
    }
    url.searchParams.set("q", TextFormat.clamp(text, 140));
    const colours = DepopFilters.coloursParam(query.color);
    if (colours) url.searchParams.set("colours", colours);
    if (kind === "specific") {
      const sizes = DepopFilters.sizesParam(query.size);
      if (sizes) url.searchParams.set("sizes", sizes);
    }
    if (query.maxPrice != null) {
      url.searchParams.set("priceMax", String(Math.max(0, Math.floor(query.maxPrice))));
    }
    url.searchParams.set("gender", "female");
    url.searchParams.set("sort", "priceAscending");
    return url.toString();
  }
}
