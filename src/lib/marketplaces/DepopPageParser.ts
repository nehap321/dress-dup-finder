import { JsonScan } from "./JsonScan";
import { JsonValue } from "../product/JsonValue";
import type { Money } from "../product/ProductInfo";
import { TextFormat } from "../product/TextFormat";
import type { Listing } from "./Listing";

export class DepopPageParser {
  static parse(status: number, html: string): { blocked: boolean; listings: Listing[] } {
    if (DepopPageParser.looksBlocked(status, html)) {
      return { blocked: true, listings: [] };
    }
    const listings = DepopPageParser.dedupe([
      ...DepopPageParser.fromEmbeddedProducts(html),
      ...DepopPageParser.fromJsonLd(html),
    ]);
    return { blocked: false, listings };
  }

  static looksBlocked(status: number, html: string): boolean {
    if (status === 401 || status === 403 || status === 429 || status === 503) return true;
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.toLowerCase() ?? "";
    if (title.includes("forbidden") || title.includes("just a moment") || title.includes("access denied")) {
      return true;
    }
    const head = html.slice(0, 2500).toLowerCase();
    return head.includes("cf-browser-verification") || head.includes("attention required! | cloudflare");
  }

  private static fromEmbeddedProducts(html: string): Listing[] {
    const texts = [html, ...DepopPageParser.nextFlightChunks(html)];
    const listings: Listing[] = [];
    for (const text of texts) {
      for (const products of JsonScan.productArrays(text)) {
        for (const product of products) {
          const listing = DepopPageParser.listingFromProduct(product);
          if (listing) listings.push(listing);
        }
      }
    }
    return listings;
  }

  private static nextFlightChunks(html: string): string[] {
    const chunks: string[] = [];
    const pattern = /self\.__next_f\.push\(\[\s*1\s*,\s*"((?:\\.|[^"\\])*)"\s*\]\)/g;
    for (const match of html.matchAll(pattern)) {
      const raw = match[1];
      if (!raw) continue;
      try {
        const decoded = JSON.parse(`"${raw}"`) as unknown;
        if (typeof decoded === "string") chunks.push(decoded);
      } catch {
        continue;
      }
    }
    return chunks;
  }

  private static listingFromProduct(value: unknown): Listing | null {
    const product = JsonValue.record(value);
    const slug = product ? JsonValue.string(product.slug) : null;
    if (!product || !slug || !/^[a-z0-9-]+$/i.test(slug)) return null;
    const status = (JsonValue.string(product.status) ?? "").toUpperCase();
    if (status === "SOLD") return null;
    const explicitTitle = JsonValue.string(product.name) ?? JsonValue.string(product.title);
    const title = explicitTitle ? TextFormat.cleanLine(explicitTitle) : DepopPageParser.titleFromSlug(slug);
    if (!title) return null;
    const brand = JsonValue.string(product.brand_name);
    const sizes = Array.isArray(product.sizes)
      ? product.sizes.filter((size): size is string => typeof size === "string" && size.trim().length > 0)
      : [];
    return {
      marketplace: "depop",
      title,
      url: `https://www.depop.com/products/${slug}/`,
      thumbnailUrl: DepopPageParser.thumbnail(product),
      price: DepopPageParser.priceOf(product),
      size: sizes.length > 0 ? sizes.join(", ") : null,
      brand: brand ? TextFormat.displayBrand(brand) : null,
      source: "depop.com",
    };
  }

  private static titleFromSlug(slug: string): string {
    const parts = slug.split("-").filter(Boolean);
    if (parts.length > 2 && /^[a-f0-9]{4,}$/i.test(parts[parts.length - 1] ?? "")) parts.pop();
    if (parts.length > 1) parts.shift();
    return TextFormat.titleCaseWords(parts.join(" "));
  }

  private static thumbnail(product: Record<string, unknown>): string | null {
    const preview = JsonValue.record(product.preview);
    const fromPreview = preview ? DepopPageParser.sizedImage(preview) : null;
    if (fromPreview) return fromPreview;
    if (!Array.isArray(product.pictures)) return null;
    for (const picture of product.pictures) {
      const record = JsonValue.record(picture);
      const url = record ? DepopPageParser.sizedImage(record) : null;
      if (url) return url;
    }
    return null;
  }

  private static sizedImage(map: Record<string, unknown>): string | null {
    for (const key of ["320", "210", "150", "480", "640", "960", "1280"]) {
      const value = JsonValue.string(map[key]);
      if (value && /^https?:\/\//i.test(value)) return value;
    }
    return null;
  }

  private static priceOf(product: Record<string, unknown>): Money | null {
    const pricing = JsonValue.record(product.pricing);
    if (!pricing) return null;
    const currency = JsonValue.string(pricing.currency_name);
    const reduced = pricing.is_reduced === true;
    const discounted = DepopPageParser.amountAt(pricing.discounted_price);
    const original = DepopPageParser.amountAt(pricing.original_price);
    const amount = reduced && discounted != null ? discounted : original;
    if (amount == null) return null;
    return {
      amount,
      currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
    };
  }

  private static amountAt(node: unknown): number | null {
    const record = JsonValue.record(node);
    const breakdown = record ? JsonValue.record(record.price_breakdown) : null;
    const price = breakdown ? JsonValue.record(breakdown.price) : null;
    const amount = price ? JsonValue.number(price.amount) : null;
    if (amount == null || amount < 0) return null;
    return Math.round(amount * 100) / 100;
  }

  private static fromJsonLd(html: string): Listing[] {
    const listings: Listing[] = [];
    const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    for (const match of html.matchAll(pattern)) {
      try {
        DepopPageParser.collectJsonLd(JSON.parse(match[1] ?? "") as unknown, listings);
      } catch {
        continue;
      }
    }
    return listings;
  }

  private static collectJsonLd(node: unknown, listings: Listing[]): void {
    if (Array.isArray(node)) {
      for (const item of node) DepopPageParser.collectJsonLd(item, listings);
      return;
    }
    const record = JsonValue.record(node);
    if (!record) return;
    const type = record["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (types.includes("ItemList") && Array.isArray(record.itemListElement)) {
      for (const element of record.itemListElement) DepopPageParser.collectJsonLd(element, listings);
    }
    if (types.includes("ListItem")) DepopPageParser.collectJsonLd(record.item ?? record, listings);
    if (record["@graph"]) DepopPageParser.collectJsonLd(record["@graph"], listings);
    if (!types.includes("Product")) return;
    const name = JsonValue.string(record.name);
    const rawUrl = JsonValue.string(record.url);
    if (!name || !rawUrl) return;
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return;
    }
    if (!url.hostname.endsWith("depop.com") || !url.pathname.includes("/products/")) return;
    const image = Array.isArray(record.image) ? record.image[0] : record.image;
    const thumbnail = typeof image === "string" ? image : JsonValue.string(JsonValue.record(image)?.url);
    const offer = Array.isArray(record.offers) ? record.offers[0] : record.offers;
    const offerRecord = JsonValue.record(offer);
    const amount = offerRecord ? JsonValue.number(offerRecord.price) : null;
    const currency = offerRecord ? JsonValue.string(offerRecord.priceCurrency) : null;
    listings.push({
      marketplace: "depop",
      title: TextFormat.cleanLine(name),
      url: url.toString(),
      thumbnailUrl: thumbnail && /^https?:\/\//i.test(thumbnail) ? thumbnail : null,
      price:
        amount != null && amount >= 0
          ? { amount, currency: currency && /^[A-Z]{3}$/i.test(currency) ? currency.toUpperCase() : null }
          : null,
      size: null,
      brand: null,
      source: "depop.com",
    });
  }

  private static dedupe(listings: Listing[]): Listing[] {
    const seen = new Set<string>();
    const unique: Listing[] = [];
    for (const listing of listings) {
      if (seen.has(listing.url)) continue;
      seen.add(listing.url);
      unique.push(listing);
    }
    return unique;
  }
}
