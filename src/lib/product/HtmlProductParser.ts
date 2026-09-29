import { JsonValue } from "./JsonValue";
import type { Money, ProductInfo } from "./ProductInfo";
import { TextFormat } from "./TextFormat";

export class HtmlProductParser {
  static parse(html: string, pageUrl: string): ProductInfo | null {
    const fromJsonLd = HtmlProductParser.fromJsonLd(html, pageUrl);
    if (fromJsonLd) return fromJsonLd;
    return HtmlProductParser.fromOpenGraph(html, pageUrl);
  }

  private static fromJsonLd(html: string, pageUrl: string): ProductInfo | null {
    const blocks = HtmlProductParser.jsonLdBlocks(html);
    for (const block of blocks) {
      const products: unknown[] = [];
      HtmlProductParser.collectProducts(block, products);
      for (const product of products) {
        const parsed = HtmlProductParser.productFromJsonLd(product, pageUrl);
        if (parsed) return parsed;
      }
    }
    return null;
  }

  private static productFromJsonLd(value: unknown, pageUrl: string): ProductInfo | null {
    const record = JsonValue.record(value);
    const title = record ? TextFormat.cleanLine(JsonValue.string(record.name) ?? "") : "";
    if (!record || !title) return null;
    const brand = HtmlProductParser.brandName(record.brand);
    const color = JsonValue.string(record.color);
    const images = HtmlProductParser.imageList(record.image, pageUrl);
    const price = HtmlProductParser.offerPrice(record.offers);
    const displayColor = color ? TextFormat.displayColor(color) : null;
    return {
      sourceUrl: pageUrl,
      title: HtmlProductParser.stripSiteSuffix(title, brand),
      brand,
      color: displayColor,
      colors: displayColor ? [{ name: displayColor, images }] : [],
      images,
      price,
      priceVaries: false,
    };
  }

  private static fromOpenGraph(html: string, pageUrl: string): ProductInfo | null {
    const titleRaw = HtmlProductParser.meta(html, "og:title");
    if (!titleRaw) return null;
    let path = "";
    try {
      path = new URL(pageUrl).pathname;
    } catch {
      path = "";
    }
    const type = HtmlProductParser.meta(html, "og:type");
    const priceAmount = HtmlProductParser.meta(html, "og:price:amount") ?? HtmlProductParser.meta(html, "product:price:amount");
    const looksLikeProduct = type === "product" || Boolean(priceAmount) || path.includes("/products/");
    if (!looksLikeProduct) return null;

    const brand =
      HtmlProductParser.meta(html, "product:brand") ?? HtmlProductParser.meta(html, "og:site_name");
    const color = HtmlProductParser.meta(html, "product:color") ?? HtmlProductParser.meta(html, "og:color");
    const currency =
      HtmlProductParser.meta(html, "og:price:currency") ?? HtmlProductParser.meta(html, "product:price:currency");
    const secureImages = HtmlProductParser.allMeta(html, "og:image:secure_url");
    const images = (secureImages.length > 0 ? secureImages : HtmlProductParser.allMeta(html, "og:image"))
      .map((image) => TextFormat.absoluteHttpUrl(image, pageUrl))
      .filter((image): image is string => Boolean(image))
      .slice(0, 4);
    const amount = priceAmount ? Number(priceAmount) : NaN;
    const price: Money | null = Number.isFinite(amount)
      ? { amount, currency: currency && /^[A-Z]{3}$/i.test(currency) ? currency.toUpperCase() : null }
      : null;
    const brandName = brand ? TextFormat.displayBrand(brand) : null;
    const displayColor = color ? TextFormat.displayColor(color) : null;
    return {
      sourceUrl: pageUrl,
      title: HtmlProductParser.stripSiteSuffix(TextFormat.cleanLine(titleRaw), brandName),
      brand: brandName,
      color: displayColor,
      colors: displayColor ? [{ name: displayColor, images }] : [],
      images,
      price,
      priceVaries: false,
    };
  }

  private static jsonLdBlocks(html: string): unknown[] {
    const blocks: unknown[] = [];
    const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    for (const match of html.matchAll(pattern)) {
      const raw = match[1]?.trim();
      if (!raw) continue;
      try {
        blocks.push(JSON.parse(raw));
      } catch {
        continue;
      }
    }
    return blocks;
  }

  private static collectProducts(node: unknown, out: unknown[]): void {
    if (Array.isArray(node)) {
      for (const item of node) HtmlProductParser.collectProducts(item, out);
      return;
    }
    const record = JsonValue.record(node);
    if (!record) return;
    const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
    if (types.includes("Product")) out.push(record);
    if (record["@graph"]) HtmlProductParser.collectProducts(record["@graph"], out);
  }

  private static brandName(value: unknown): string | null {
    if (typeof value === "string") {
      const brand = TextFormat.displayBrand(value);
      return brand || null;
    }
    const record = JsonValue.record(value);
    const name = record ? JsonValue.string(record.name) : null;
    return name ? TextFormat.displayBrand(name) : null;
  }

  private static imageList(value: unknown, pageUrl: string): string[] {
    const items = Array.isArray(value) ? value : [value];
    const urls: string[] = [];
    for (const item of items) {
      const raw = typeof item === "string" ? item : JsonValue.string(JsonValue.record(item)?.url);
      if (!raw) continue;
      const absolute = TextFormat.absoluteHttpUrl(raw, pageUrl);
      if (absolute && !urls.includes(absolute)) urls.push(absolute);
      if (urls.length >= 4) break;
    }
    return urls;
  }

  private static offerPrice(value: unknown): Money | null {
    const offers = Array.isArray(value) ? value : [value];
    for (const offer of offers) {
      const record = JsonValue.record(offer);
      if (!record) continue;
      const nested = record.offers ? HtmlProductParser.offerPrice(record.offers) : null;
      if (nested) return nested;
      const amount = JsonValue.number(record.price ?? record.lowPrice);
      if (amount == null) continue;
      const currency = JsonValue.string(record.priceCurrency);
      return {
        amount,
        currency: currency && /^[A-Z]{3}$/i.test(currency) ? currency.toUpperCase() : null,
      };
    }
    return null;
  }

  private static stripSiteSuffix(title: string, brand: string | null): string {
    if (!brand) return title;
    const pattern = new RegExp(`\\s*[|\\-–—]\\s*${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
    return title.replace(pattern, "").trim() || title;
  }

  private static meta(html: string, key: string): string | null {
    return HtmlProductParser.allMeta(html, key)[0] ?? null;
  }

  private static allMeta(html: string, key: string): string[] {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(
        `<meta\\b[^>]*\\b(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*\\bcontent\\s*=\\s*["']([^"']*)["'][^>]*>`,
        "gi",
      ),
      new RegExp(
        `<meta\\b[^>]*\\bcontent\\s*=\\s*["']([^"']*)["'][^>]*\\b(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*>`,
        "gi",
      ),
    ];
    const values: string[] = [];
    for (const pattern of patterns) {
      for (const match of html.matchAll(pattern)) {
        const value = match[1] ? TextFormat.cleanLine(match[1]) : "";
        if (value && !values.includes(value)) values.push(value);
      }
    }
    return values;
  }
}
