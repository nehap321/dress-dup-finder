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
    const images = ShopifyProductParser.imagesFrom(record, pageUrl);
    const colors = ShopifyProductParser.colorsFrom(record, pageUrl, images);
    const only = colors.length === 1 ? colors[0] : null;
    const price = ShopifyProductParser.priceFrom(record);
    return {
      sourceUrl: pageUrl,
      title,
      brand: brand ? TextFormat.displayBrand(brand) : null,
      color: only?.name ?? null,
      colors,
      images: only && only.images.length > 0 ? only.images : images,
      price,
      priceVaries: record.price_varies === true,
    };
  }

  private static colorsFrom(
    record: Record<string, unknown>,
    pageUrl: string,
    fallbackImages: string[],
  ): { name: string; images: string[] }[] {
    if (!Array.isArray(record.options)) return [];
    const colorOption = record.options.find((option) => {
      const item = JsonValue.record(option);
      const name = item ? JsonValue.string(item.name) : null;
      return Boolean(item && name && /colou?r/i.test(name));
    });
    const option = JsonValue.record(colorOption);
    if (!option || !Array.isArray(option.values)) return [];
    const position = typeof option.position === "number" ? option.position : 1;
    const pictures = ShopifyProductParser.pictureIndex(record, pageUrl);
    const colors: { name: string; images: string[] }[] = [];
    for (const value of option.values) {
      if (typeof value !== "string") continue;
      const name = TextFormat.displayColor(value);
      if (!name || colors.some((color) => color.name.toLowerCase() === name.toLowerCase())) continue;
      const images = ShopifyProductParser.imagesForColor(record, value, position, pictures);
      colors.push({ name, images: images.length > 0 ? images : fallbackImages });
      if (colors.length >= 12) break;
    }
    return colors;
  }

  private static pictureIndex(record: Record<string, unknown>, pageUrl: string): Map<number, string> {
    const pictures = new Map<number, string>();
    if (!Array.isArray(record.images)) return pictures;
    for (const image of record.images) {
      const item = JsonValue.record(image);
      const src = item ? JsonValue.string(item.src) : typeof image === "string" ? image : null;
      const absolute = src ? TextFormat.absoluteHttpUrl(src, pageUrl) : null;
      const ids = item && Array.isArray(item.variant_ids) ? item.variant_ids : [];
      if (!absolute) continue;
      for (const id of ids) {
        if (typeof id === "number") pictures.set(id, absolute);
      }
    }
    return pictures;
  }

  private static imagesForColor(
    record: Record<string, unknown>,
    rawValue: string,
    position: number,
    pictures: Map<number, string>,
  ): string[] {
    if (!Array.isArray(record.variants)) return [];
    const key = `option${position}`;
    const images: string[] = [];
    for (const variant of record.variants) {
      const item = JsonValue.record(variant);
      if (!item || JsonValue.string(item[key])?.toLowerCase() !== rawValue.toLowerCase()) continue;
      const id = typeof item.id === "number" ? item.id : null;
      const featured = JsonValue.record(item.featured_image);
      const featuredSrc = featured ? JsonValue.string(featured.src) : null;
      const absolute = featuredSrc
        ? TextFormat.absoluteHttpUrl(featuredSrc, "https://cdn.shopify.com")
        : id != null
          ? pictures.get(id) ?? null
          : null;
      if (absolute && !images.includes(absolute)) images.push(absolute);
      if (id != null && pictures.get(id) && !images.includes(pictures.get(id) as string)) {
        images.push(pictures.get(id) as string);
      }
    }
    return images.slice(0, 4);
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
