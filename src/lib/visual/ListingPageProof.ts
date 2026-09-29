import type { PageTransport } from "../http/PageTransport";
import type { Listing } from "../marketplaces/Listing";
import { HtmlProductParser } from "../product/HtmlProductParser";
import { JsonValue } from "../product/JsonValue";
import type { Money } from "../product/ProductInfo";
import { ProductPaths } from "../product/ProductPaths";
import { ShopifyProductParser } from "../product/ShopifyProductParser";
import { TextFormat } from "../product/TextFormat";
import { PhotoStem } from "./PhotoStem";

export class ListingPageProof {
  static async keep(listing: Listing, matchedImage: string, transport: PageTransport): Promise<Listing | null> {
    let page;
    try {
      page = await transport.get(listing.url);
    } catch {
      return null;
    }
    if (page.status >= 400 || !page.body) return null;
    const proved = ListingPageProof.confirm(page.body, page.url || listing.url, matchedImage, listing.title);
    if (proved) return { ...listing, ...proved, source: listing.source };
    const shopify = await ListingPageProof.shopify(listing.url, transport);
    if (!shopify) return null;
    const fromShopify = ListingPageProof.confirm(shopify, listing.url, matchedImage, listing.title);
    if (!fromShopify) return null;
    return { ...listing, ...fromShopify, source: listing.source };
  }

  static confirm(html: string, pageUrl: string, matchedImage: string, fallbackTitle: string): Pick<Listing, "title" | "thumbnailUrl" | "price"> | null {
    const found = ListingPageProof.photoOnPage(html, pageUrl, matchedImage);
    const photo = found?.replace(/^http:\/\//i, "https://") ?? null;
    const price = ListingPageProof.price(html, pageUrl);
    if (!photo || !price) return null;
    const parsed = HtmlProductParser.parse(html, pageUrl) ?? ShopifyProductParser.parse(html, pageUrl);
    const title = parsed?.title || fallbackTitle;
    if (!title) return null;
    return { title, thumbnailUrl: photo, price };
  }

  static photoOnPage(html: string, pageUrl: string, matchedImage: string): string | null {
    const stem = PhotoStem.of(matchedImage);
    if (stem.length < 8 || !html.toLowerCase().includes(stem)) return null;
    const images = ListingPageProof.imageUrls(html, pageUrl);
    return images.find((image) => PhotoStem.same(image, matchedImage)) ?? null;
  }

  static price(html: string, pageUrl: string): Money | null {
    const parsed = HtmlProductParser.parse(html, pageUrl);
    if (parsed?.price) return parsed.price;
    const shopify = ShopifyProductParser.parse(html, pageUrl);
    if (shopify?.price) return shopify.price;
    const meta = html.match(/property="(?:og:price:amount|product:price:amount)"\s+content="([\d.]+)"/i);
    const amount = meta?.[1] ? Number(meta[1]) : NaN;
    if (!Number.isFinite(amount)) return null;
    const currency = html.match(/property="(?:og:price:currency|product:price:currency)"\s+content="([A-Za-z]{3})"/i)?.[1];
    return { amount, currency: currency ? currency.toUpperCase() : null };
  }

  private static imageUrls(html: string, pageUrl: string): string[] {
    const urls: string[] = [];
    const add = (value: string | null) => {
      if (!value) return;
      const absolute = TextFormat.absoluteHttpUrl(TextFormat.decodeEntities(value), pageUrl);
      if (absolute && !urls.includes(absolute)) urls.push(absolute);
    };
    for (const match of html.matchAll(/(?:src|content|href)="([^"]+\.(?:jpe?g|png|webp|gif|avif)[^"]*)"/gi)) {
      add(match[1] ?? null);
    }
    for (const match of html.matchAll(/\\u002[Ff](https?:\\u002[Ff]\\u002[Ff][^"\\]+\.(?:jpe?g|png|webp))/gi)) {
      add((match[1] ?? "").replace(/\\u002[Ff]/g, "/"));
    }
    try {
      const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) ?? [];
      for (const block of blocks) {
        const json = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
        const data = JSON.parse(json) as unknown;
        ListingPageProof.collectJsonImages(data, pageUrl, add);
      }
    } catch {
      // A broken script block is ignored. Other image tags still count.
    }
    return urls;
  }

  private static collectJsonImages(value: unknown, pageUrl: string, add: (value: string | null) => void): void {
    if (typeof value === "string") {
      if (/\.(?:jpe?g|png|webp)/i.test(value)) add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) ListingPageProof.collectJsonImages(item, pageUrl, add);
      return;
    }
    const record = JsonValue.record(value);
    if (!record) return;
    for (const key of ["image", "src", "url"]) {
      if (key in record) ListingPageProof.collectJsonImages(record[key], pageUrl, add);
    }
  }

  private static async shopify(pageUrl: string, transport: PageTransport): Promise<string | null> {
    let url: URL;
    try {
      url = new URL(pageUrl);
    } catch {
      return null;
    }
    const jsonUrl = ProductPaths.shopifyJsUrl(url);
    if (!jsonUrl) return null;
    try {
      const page = await transport.get(jsonUrl);
      return page.status === 200 ? page.body : null;
    } catch {
      return null;
    }
  }
}
