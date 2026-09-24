import { JsonValue } from "./JsonValue";
import type { Money, ProductInfo } from "./ProductInfo";
import { TextFormat } from "./TextFormat";

export class ShopifyProductParser {
  static parse(body: string, pageUrl: string): ProductInfo | null {
    try {
      return ShopifyProductParser.fromData(JSON.parse(body.replace(/^\uFEFF/, "")) as unknown, pageUrl);
    } catch {
      return null;
    }
  }

  static fromData(data: unknown, pageUrl: string): ProductInfo | null {
    const record = JsonValue.record(data);
    const title = record ? TextFormat.cleanLine(JsonValue.string(record.title) ?? "") : "";
    if (!record || !title) return null;
    if (!Array.isArray(record.variants) && !JsonValue.string(record.vendor)) return null;

    const brand = JsonValue.string(record.vendor);
    const color = ShopifyProductParser.colorFrom(record);
    const images = ShopifyProductParser.imagesFrom(record, pageUrl);
    const price = ShopifyProductParser.priceFrom(record);
    return {
      sourceUrl: pageUrl,
      title,
      brand: brand ? TextFormat.displayBrand(brand) : null,
      color,
      images,
      price,
      priceVaries: record.price_varies === true,
    };
  }

  private static colorFrom(record: Record<string, unknown>): string | null {
    if (!Array.isArray(record.options)) return null;
    for (const option of record.options) {
      const item = JsonValue.record(option);
      const name = item ? JsonValue.string(item.name) : null;
      if (!item || !name || !/colou?r/i.test(name) || !Array.isArray(item.values)) continue;
      const values = item.values
        .map((value) => (typeof value === "string" ? TextFormat.displayColor(value) : ""))
        .filter(Boolean);
      if (values.length > 0) return values.slice(0, 4).join(", ");
    }
    return null;
  }

  private static imagesFrom(record: Record<string, unknown>, pageUrl: string): string[] {
    const raw = Array.isArray(record.images) ? record.images : [];
    const urls: string[] = [];
    for (const image of raw) {
      const value =
        typeof image === "string"
          ? image
          : JsonValue.string(JsonValue.record(image)?.src) ?? JsonValue.string(image);
      if (!value) continue;
      const absolute = TextFormat.absoluteHttpUrl(value, pageUrl);
      if (absolute && !urls.includes(absolute)) urls.push(absolute);
      if (urls.length >= 4) break;
    }
    return urls;
  }

  private static priceFrom(record: Record<string, unknown>): Money | null {
    const raw = record.price ?? record.price_min;
    const amount = ShopifyProductParser.shopifyAmount(raw);
    if (amount == null) return null;
    const currency = JsonValue.string(record.currency);
    return {
      amount,
      currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
    };
  }

  /** Shopify's public `/products/{handle}.js` endpoint reports price as integer cents. */
  private static shopifyAmount(raw: unknown): number | null {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return Number.isInteger(raw) ? raw / 100 : raw;
    }
    if (typeof raw !== "string" || !raw.trim()) return null;
    if (raw.includes(".")) {
      const major = Number(raw);
      return Number.isFinite(major) ? major : null;
    }
    const cents = Number(raw);
    return Number.isFinite(cents) ? cents / 100 : null;
  }
}
