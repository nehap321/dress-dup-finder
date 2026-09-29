import { describe, expect, it } from "vitest";
import { AddressPolicy } from "./http/AddressPolicy";
import { SafeFetchError } from "./http/SafeFetchError";
import type { PageTransport } from "./http/PageTransport";
import { MatchService } from "./match/MatchService";
import { DepopFilters } from "./marketplaces/DepopFilters";
import { DepopMarketplace } from "./marketplaces/DepopMarketplace";
import { DepopPageParser } from "./marketplaces/DepopPageParser";
import { DepopSearchLink } from "./marketplaces/DepopSearchLink";
import { HtmlProductParser } from "./product/HtmlProductParser";
import type { ProductInfo } from "./product/ProductInfo";
import { ProductFetcher } from "./product/ProductFetcher";
import { ShopifyProductParser } from "./product/ShopifyProductParser";
import { SearchQuery } from "./search/SearchQuery";

const dress: ProductInfo = {
  sourceUrl: "https://www.windsorstore.com/products/polly-formal-high-slit-dress",
  title: "Polly Formal High Slit Dress",
  brand: "Windsor",
  color: "Yellow",
  images: [],
  price: { amount: 9.97, currency: "USD" },
  priceVaries: false,
  colors: [{ name: "Yellow", images: [] }],
};

function page(status: number, body: string, contentType = "text/html") {
  return { status, body, contentType };
}

function transport(pages: Record<string, { status: number; body: string; contentType?: string }>): PageTransport {
  return {
    async get(url: string) {
      const found = pages[url];
      if (!found) return { url, status: 404, body: "missing", contentType: "text/plain" };
      return { url, ...page(found.status, found.body, found.contentType) };
    },
  };
}

describe("AddressPolicy", () => {
  it("blocks private and local addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.4", "172.16.5.5", "169.254.169.254", "::1", "fd00::1"]) {
      expect(AddressPolicy.isPrivateIp(ip)).toBe(true);
    }
    expect(AddressPolicy.isPrivateIp("8.8.8.8")).toBe(false);
    expect(AddressPolicy.isPrivateIp("::ffff:127.0.0.1")).toBe(true);
  });

  it("rejects non-public URLs before any request", () => {
    expect(() => AddressPolicy.parse("http://127.0.0.1/secret")).toThrow(SafeFetchError);
    expect(() => AddressPolicy.parse("file:///etc/passwd")).toThrow(SafeFetchError);
    expect(() => AddressPolicy.parse("https://user:pass@example.com/dress")).toThrow(SafeFetchError);
    expect(AddressPolicy.parse("https://www.windsorstore.com/products/dress").hostname).toBe(
      "www.windsorstore.com",
    );
  });
});

describe("product parsers", () => {
  it("reads a Shopify product.js payload", () => {
    const product = ShopifyProductParser.parse(
      JSON.stringify({
        title: "Polly Formal High Slit Dress",
        vendor: "Windsor",
        price: 997,
        price_varies: false,
        options: [
          { name: "Color", values: ["YELLOW"] },
          { name: "Size", values: ["S"] },
        ],
        images: ["//cdn.shopify.com/s/files/example.jpg"],
        variants: [{ price: 997 }],
      }),
      "https://www.windsorstore.com/products/polly-formal-high-slit-dress",
    );
    expect(product).toMatchObject({
      title: "Polly Formal High Slit Dress",
      brand: "Windsor",
      color: "Yellow",
      price: { amount: 9.97, currency: null },
    });
    expect(product?.images[0]).toBe("https://cdn.shopify.com/s/files/example.jpg");
  });

  it("reads JSON-LD and Open Graph product pages", () => {
    const jsonLd = HtmlProductParser.parse(
      `<script type="application/ld+json">{"@graph":[{"@type":"Product","name":"Kenzie Dress | Windsor","color":"WHITE","brand":{"@type":"Brand","name":"Windsor"},"image":["https://cdn.example/dress.jpg"],"offers":{"price":"19.97","priceCurrency":"USD"}}]}</script>`,
      "https://www.windsorstore.com/products/kenzie",
    );
    expect(jsonLd).toMatchObject({
      title: "Kenzie Dress",
      brand: "Windsor",
      color: "White",
      price: { amount: 19.97, currency: "USD" },
      images: ["https://cdn.example/dress.jpg"],
    });

    const openGraph = HtmlProductParser.parse(
      `<meta property="og:type" content="product"><meta property="og:title" content="Adrienne Dress"><meta property="og:price:amount" content="49.90"><meta property="og:price:currency" content="USD"><meta property="og:image:secure_url" content="https://cdn.example/a.jpg">`,
      "https://shop.example/products/adrienne",
    );
    expect(openGraph?.title).toBe("Adrienne Dress");
    expect(openGraph?.price).toEqual({ amount: 49.9, currency: "USD" });
    expect(HtmlProductParser.parse(`<meta property="og:title" content="Home">`, "https://shop.example/")).toBeNull();
  });

  it("prefers Shopify JSON and fills currency from meta.json", async () => {
    const origin = "https://shop.example";
    const product = await ProductFetcher.fetch(`${origin}/products/polly-dress`, transport({
      [`${origin}/products/polly-dress.js`]: {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          title: "Polly Dress",
          vendor: "Windsor",
          price: 997,
          options: [{ name: "Color", values: ["YELLOW"] }],
          images: [],
          variants: [],
        }),
      },
      [`${origin}/meta.json`]: {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ currency: "USD", name: "Windsor" }),
      },
    }));
    expect(product.price).toEqual({ amount: 9.97, currency: "USD" });
    expect(product.color).toBe("Yellow");
  });

  it("falls back to HTML when the Shopify endpoint is missing", async () => {
    const url = "https://shop.example/products/lace-dress";
    const product = await ProductFetcher.fetch(url, transport({
      "https://shop.example/products/lace-dress.js": { status: 404, body: "nope" },
      [url]: {
        status: 200,
        body: `<meta property="og:type" content="product"><meta property="og:title" content="Lace Dress"><meta property="product:brand" content="ATELIER">`,
      },
    }));
    expect(product.title).toBe("Lace Dress");
    expect(product.brand).toBe("Atelier");
  });
});

describe("Depop search", () => {
  it("builds a prefilled womenswear search from the dress and filters", () => {
    const query = SearchQuery.build(dress, { size: "S", color: "yellow", maxPrice: 40 });
    expect(query.text).toBe("Polly Formal High Slit Dress yellow");
    expect(query.text.toLowerCase()).not.toContain("windsor");
    expect(query.broaderText).toBe("slit dress yellow");
    expect(DepopFilters.sizesParam("S")).toBe("US-S");
    expect(DepopFilters.sizesParam("US 4")).toBe("US-4");
    expect(DepopFilters.coloursParam("Black / White Polka Dot")).toBe("black,white");

    const specific = new URL(DepopSearchLink.specific(query));
    expect(specific.pathname).toBe("/us/search/");
    expect(specific.searchParams.get("q")).toContain("Polly Formal High Slit Dress");
    expect(specific.searchParams.get("q")?.toLowerCase()).not.toContain("windsor");
    expect(specific.searchParams.get("q")).toContain("size S");
    expect(specific.searchParams.get("colours")).toBe("yellow");
    expect(specific.searchParams.get("sizes")).toBe("US-S");
    expect(specific.searchParams.get("priceMax")).toBe("40");
    expect(specific.searchParams.get("gender")).toBe("female");
    expect(specific.searchParams.get("sort")).toBe("priceAscending");
    expect(new URL(DepopSearchLink.broader(query)).searchParams.get("sizes")).toBeNull();
  });

  it("parses real listing fields and ignores a blocked page", () => {
    const payload = JSON.stringify({
      data: {
        products: [
          {
            slug: "seller-yellow-slit-dress-ab12",
            status: "ONSALE",
            brand_name: "Windsor",
            sizes: ["S"],
            pricing: {
              currency_name: "USD",
              is_reduced: false,
              original_price: { price_breakdown: { price: { amount: "28.00" } } },
            },
            preview: { "320": "https://media.example/thumb.jpg" },
          },
          {
            slug: "seller-sold-dress-cd34",
            status: "SOLD",
            pricing: { original_price: { price_breakdown: { price: { amount: "10.00" } } } },
          },
        ],
      },
    });
    const inner = JSON.stringify(payload).slice(1, -1);
    const html = `<!doctype html><title>Search</title><script>self.__next_f.push([1,"${inner}"])</script>`;
    const parsed = DepopPageParser.parse(200, html);
    expect(parsed.blocked).toBe(false);
    expect(parsed.listings).toHaveLength(1);
    expect(parsed.listings[0]).toMatchObject({
      title: "Yellow Slit Dress",
      url: "https://www.depop.com/products/seller-yellow-slit-dress-ab12/",
      thumbnailUrl: "https://media.example/thumb.jpg",
      price: { amount: 28, currency: "USD" },
      size: "S",
      brand: "Windsor",
    });

    const blocked = DepopPageParser.parse(
      403,
      `<title>Forbidden - Depop</title><script>{"products":[{"slug":"should-not-appear-ab12"}]}</script>`,
    );
    expect(blocked.blocked).toBe(true);
    expect(blocked.listings).toEqual([]);
  });

  it("returns no invented listings when Depop forbids the search", async () => {
    const result = await DepopMarketplace.search(
      dress,
      { size: "S", color: "yellow", maxPrice: 40 },
      transport({
        [new URL(DepopSearchLink.specific(SearchQuery.build(dress, { size: "S", color: "yellow", maxPrice: 40 }))).toString()]:
          { status: 403, body: "<title>Forbidden - Depop</title>" },
      }),
    );
    expect(result.mode).toBe("unavailable");
    expect(result.listings).toEqual([]);
    expect(result.searchUrl).toContain("https://www.depop.com/us/search/");
    expect(result.notice.toLowerCase()).toContain("does not");
  });

  it("keeps readable listings under the max price", async () => {
    const query = SearchQuery.build(dress, { size: null, color: null, maxPrice: 40 });
    const searchUrl = DepopSearchLink.specific(query);
    const result = await DepopMarketplace.search(dress, { size: null, color: null, maxPrice: 40 }, transport({
      [searchUrl]: {
        status: 200,
        body: JSON.stringify({
          products: [
            {
              slug: "ana-cheap-dress-aa11",
              status: "ONSALE",
              name: "Cheap yellow dress",
              pricing: {
                currency_name: "USD",
                original_price: { price_breakdown: { price: { amount: "22.00" } } },
              },
            },
            {
              slug: "ana-pricey-dress-bb22",
              status: "ONSALE",
              name: "Pricey yellow dress",
              pricing: {
                currency_name: "USD",
                original_price: { price_breakdown: { price: { amount: "80.00" } } },
              },
            },
          ],
        }),
      },
    }));
    expect(result.mode).toBe("listings");
    expect(result.listings.map((listing) => listing.title)).toEqual(["Cheap yellow dress"]);
  });
});

describe("style and color", () => {
  it("asks which color when the product page lists several", async () => {
    const url = "https://shop.example/products/floral-maxi";
    const result = await MatchService.match(
      { url },
      transport({
        [`${url}.js`]: {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            title: "Floral Maxi",
            vendor: "Windsor",
            price: 4900,
            options: [{ name: "Color", position: 1, values: ["BLACK", "BLUE"] }],
            images: [],
            variants: [
              { id: 1, option1: "BLACK", featured_image: { src: "https://cdn.example/black.jpg" }, price: 4900 },
              { id: 2, option1: "BLUE", featured_image: { src: "https://cdn.example/blue.jpg" }, price: 4900 },
            ],
          }),
        },
        "https://shop.example/meta.json": {
          status: 200,
          body: JSON.stringify({ currency: "USD" }),
        },
      }),
    );
    expect(result.ok && result.step).toBe("color");
    if (result.ok && result.step === "color") {
      expect(result.product.colors.map((color) => color.name)).toEqual(["Black", "Blue"]);
      expect(result.product.colors[0]?.images).toEqual(["https://cdn.example/black.jpg"]);
    }
  });

  it("reads Poshmark photos and prices and eBay index cards", async () => {
    const { PoshmarkSearch } = await import("./marketplaces/PoshmarkSearch");
    const { EbayIndexSearch } = await import("./marketplaces/EbayIndexSearch");
    const { ListingOrder } = await import("./search/ListingOrder");
    const posh = PoshmarkSearch.parse(
      JSON.stringify({
        data: [
          {
            id: "abc123",
            title: "Blue satin mini dress",
            price_amount: { val: "18.0", currency_code: "USD" },
            cover_shot: { url_small: "https://cdn.example/blue-mini.jpg" },
            inventory: { size_quantities: [{ size_obj: { display: "S", display_with_size_system: "US S" } }] },
          },
          { id: "nope", title: "No photo", price_amount: { val: "10", currency_code: "USD" } },
        ],
      }),
    );
    expect(posh).toHaveLength(1);
    expect(posh[0]).toMatchObject({
      price: { amount: 18, currency: "USD" },
      thumbnailUrl: "https://cdn.example/blue-mini.jpg",
      size: "US S",
    });
    const ebay = EbayIndexSearch.parseIndex(`
      <ul>
        <li id="item-123456789012"><img src="https://www.picclickimg.com/abc/Blue-Mini.webp" alt=""><h3>Blue satin mini dress</h3><div class="price"><strong>$15.00</strong> Buy It Now</div> See on eBay</li>
        <li id="item-999">no price</li>
      </ul>`);
    expect(ebay.map((listing) => listing.url)).toEqual(["https://www.ebay.com/itm/123456789012"]);
    expect(ebay[0]?.price).toEqual({ amount: 15, currency: "USD" });
    const ordered = ListingOrder.byLookAndPrice(
      [
        { ...posh[0]!, title: "Red gown", price: { amount: 5, currency: "USD" } },
        { ...posh[0]!, title: "Blue mini dress", url: "https://poshmark.com/listing/b", price: { amount: 40, currency: "USD" } },
        { ...posh[0]!, title: "Blue mini dress cheap", url: "https://poshmark.com/listing/a", price: { amount: 12, currency: "USD" } },
      ],
      ["blue", "mini", "dress"],
    );
    expect(ordered.map((listing) => listing.price?.amount)).toEqual([12, 40, 5]);
  });
});

describe("MatchService", () => {
  it("rejects empty and private URLs without fetching them", async () => {
    const empty = await MatchService.match({ url: "  " });
    expect(empty.ok).toBe(false);
    const local = await MatchService.match({ url: "http://127.0.0.1/admin" });
    expect(local.ok).toBe(false);
    if (!local.ok) expect(local.error.code).toBe("invalid_url");
  });
});
