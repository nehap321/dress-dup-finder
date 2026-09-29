import { AppConfig } from "../config/AppConfig";
import type { PageTransport } from "../http/PageTransport";
import type { Listing } from "../marketplaces/Listing";
import { JsonValue } from "../product/JsonValue";
import { TextFormat } from "../product/TextFormat";

export class GoogleLensSearch {
  static isConfigured(): boolean {
    return Boolean(AppConfig.serpApiKey());
  }

  static async search(imageUrl: string, transport: PageTransport): Promise<Listing[]> {
    const key = AppConfig.serpApiKey();
    if (!key) return [];
    const endpoint = new URL("https://serpapi.com/search.json");
    endpoint.searchParams.set("engine", "google_lens");
    endpoint.searchParams.set("type", "visual_matches");
    endpoint.searchParams.set("url", imageUrl);
    endpoint.searchParams.set("api_key", key);
    const page = await transport.get(endpoint.toString());
    if (page.status >= 400) return [];
    return GoogleLensSearch.parse(page.body);
  }

  static parse(body: string): Listing[] {
    let data: unknown;
    try {
      data = JSON.parse(body) as unknown;
    } catch {
      return [];
    }
    const matches = JsonValue.record(data)?.visual_matches;
    if (!Array.isArray(matches)) return [];
    const listings: Listing[] = [];
    for (const match of matches) {
      const record = JsonValue.record(match);
      const title = record ? TextFormat.cleanLine(JsonValue.string(record.title) ?? "") : "";
      const link = record ? JsonValue.string(record.link) : null;
      if (!record || !title || !link || !/^https?:\/\//i.test(link)) continue;
      const source = JsonValue.string(record.source);
      const thumbnail = JsonValue.string(record.thumbnail);
      const price = JsonValue.record(record.price);
      const amount = price ? JsonValue.number(price.extracted_value) : null;
      const currency = price ? JsonValue.string(price.currency) : null;
      listings.push({
        marketplace: "visual",
        title,
        url: link,
        thumbnailUrl: thumbnail && /^https?:\/\//i.test(thumbnail) ? thumbnail : null,
        price:
          amount != null
            ? { amount, currency: currency && /^[A-Z]{3}$/i.test(currency) ? currency.toUpperCase() : null }
            : null,
        size: null,
        brand: null,
        source: source ? source.toLowerCase() : GoogleLensSearch.host(link),
      });
    }
    return listings;
  }

  private static host(value: string): string | null {
    try {
      return new URL(value).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }
}
