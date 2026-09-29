import type { PageTransport } from "../http/PageTransport";
import { SafeFetch } from "../http/SafeFetch";
import { SafeFetchError } from "../http/SafeFetchError";
import { AddressPolicy } from "../http/AddressPolicy";
import { JsonValue } from "./JsonValue";
import { HtmlProductParser } from "./HtmlProductParser";
import type { ProductInfo } from "./ProductInfo";
import { ProductFetchError } from "./ProductFetchError";
import { ProductPaths } from "./ProductPaths";
import { ShopifyProductParser } from "./ShopifyProductParser";

export class ProductFetcher {
  static async fetch(rawUrl: string, transport: PageTransport = SafeFetch): Promise<ProductInfo> {
    let pageUrl: URL;
    try {
      pageUrl = AddressPolicy.parse(rawUrl);
    } catch (error) {
      if (error instanceof SafeFetchError) {
        throw new ProductFetchError(error.code, error.message);
      }
      throw new ProductFetchError("invalid_url", "Paste a public product link.");
    }

    const shopify = await ProductFetcher.tryShopify(pageUrl, transport);
    if (shopify) return shopify;
    return ProductFetcher.readHtml(pageUrl, transport);
  }

  private static async tryShopify(pageUrl: URL, transport: PageTransport): Promise<ProductInfo | null> {
    const jsonUrl = ProductPaths.shopifyJsUrl(pageUrl);
    if (!jsonUrl) return null;
    const page = await ProductFetcher.readOptional(transport, jsonUrl);
    if (!page || page.status !== 200) return null;
    const parsed = ShopifyProductParser.parse(page.body, pageUrl.toString());
    if (!parsed) return null;
    if (parsed.price?.currency) return parsed;
    const currency = await ProductFetcher.shopCurrency(pageUrl.origin, transport);
    if (!currency || !parsed.price) return parsed;
    return { ...parsed, price: { ...parsed.price, currency } };
  }

  private static async readHtml(pageUrl: URL, transport: PageTransport): Promise<ProductInfo> {
    let page;
    try {
      page = await transport.get(pageUrl.toString());
    } catch (error) {
      throw ProductFetcher.asFetchError(error);
    }
    if (page.status === 404) {
      throw new ProductFetchError("fetch_failed", "That product page wasn't found (404).");
    }
    if (page.status >= 400) {
      throw new ProductFetchError(
        "fetch_failed",
        "Couldn't fetch that product page. Check the link and try again.",
      );
    }
    const parsed = HtmlProductParser.parse(page.body, page.url || pageUrl.toString());
    if (!parsed) {
      throw new ProductFetchError(
        "not_a_product",
        "That page didn't look like a single product. Open the dress and copy the link from its product page.",
      );
    }
    return parsed;
  }

  private static async readOptional(transport: PageTransport, url: string) {
    try {
      return await transport.get(url);
    } catch {
      return null;
    }
  }

  private static async shopCurrency(origin: string, transport: PageTransport): Promise<string | null> {
    const page = await ProductFetcher.readOptional(transport, `${origin}/meta.json`);
    if (!page || page.status !== 200) return null;
    try {
      const record = JsonValue.record(JSON.parse(page.body) as unknown);
      const currency = record ? JsonValue.string(record.currency) : null;
      return currency && /^[A-Z]{3}$/.test(currency) ? currency : null;
    } catch {
      return null;
    }
  }

  private static asFetchError(error: unknown): ProductFetchError {
    if (error instanceof ProductFetchError) return error;
    if (error instanceof SafeFetchError) return new ProductFetchError(error.code, error.message);
    return new ProductFetchError(
      "fetch_failed",
      "Couldn't fetch that product page. Check the link and try again.",
    );
  }
}
