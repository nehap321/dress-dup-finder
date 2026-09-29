import { describe, expect, it } from "vitest";
import type { PageTransport } from "../http/PageTransport";
import type { ProductInfo } from "../product/ProductInfo";
import { GoogleLensSearch } from "./GoogleLensSearch";
import { SourcePagePicker } from "./SourcePagePicker";
import { VisualMatchFilters } from "./VisualMatchFilters";
import { VisualMatchFinder } from "./VisualMatchFinder";
import { ListingPageProof } from "./ListingPageProof";
import { YandexPageParser } from "./YandexPageParser";
import { YandexVisualSearch } from "./YandexVisualSearch";

const dress: ProductInfo = {
  sourceUrl: "https://www.windsorstore.com/products/polly-formal-high-slit-dress-050020089999",
  title: "Polly Formal High Slit Dress",
  brand: "Windsor",
  color: "Yellow",
  images: ["https://cdn.shopify.com/s/files/1/0070/8853/7651/products/05002-0089_1.jpg"],
  price: { amount: 9.97, currency: "USD" },
  priceVaries: false,
  colors: [{ name: "Yellow", images: ["https://cdn.shopify.com/s/files/1/0070/8853/7651/products/05002-0089_1.jpg"] }],
};

const similarHtml = `
<script>{"cbirSimilar":{"thumbs":[
  {"imageUrl":"//avatars.mds.yandex.net/i?id=abc","width":200,"height":320,"title":"Classic A Line V Neck Yellow Long Prom Dress with Split Front","linkUrl":"/images/search?img_url=https%3A%2F%2Fzapaka.ca%2Fcdn%2Fshop%2Fproducts%2Fyellow-slit.jpg&rpt=imageview"},
  {"imageUrl":"//avatars.mds.yandex.net/i?id=def","width":200,"height":320,"title":"Black mini dress","linkUrl":"/images/search?img_url=https%3A%2F%2Fcdn.shopify.com%2Fs%2Ffiles%2F1%2F0070%2F8853%2F7651%2Fproducts%2F05002-0089_1.jpg&rpt=imageview"}
]}}</script>`;

const sitesHtml = `
<script>{"cbirSites":{"sites":[
  {"title":"spam shop","url":"https://www.alupunch.com.tr/gweb.aspx?shop=windsor+yellow","domain":"alupunch.com.tr"},
  {"title":"Classic A Line V Neck Yellow Long Prom Dress with Split Front","url":"https://zapaka.ca/products/classic-a-line-v-neck-yellow-long-prom-dress-with-split-front","domain":"zapaka.ca"},
  {"title":"Yellow slit dress pin","url":"https://www.pinterest.com/pin/123/","domain":"pinterest.com"}
]}}</script>`;

function transport(pages: Record<string, string>): PageTransport {
  return {
    async get(url: string) {
      const body = pages[url];
      if (!body) return { url, status: 404, body: "missing", contentType: "text/html" };
      return { url, status: 200, body, contentType: "text/html" };
    },
  };
}

describe("visual match", () => {
  it("skips boards and doorway titles and keeps visual order", () => {
    const thumbs = YandexPageParser.similar(`
      <script>{"cbirSimilar":{"thumbs":[
        {"imageUrl":"//a","title":"windsor yellow prom dressCheap Sell - OFF64","linkUrl":"/images/search?img_url=https%3A%2F%2Fcdn.shopify.com%2Fs%2Ffiles%2F1%2Fx%2F05002-0089_1_2560x.jpg"},
        {"imageUrl":"//b","title":"630 Prom ideas","linkUrl":"/images/search?img_url=https%3A%2F%2Fi.pinimg.com%2Foriginals%2Fa.jpg"},
        {"imageUrl":"//c","title":"Stunning Yellow V-Neck Maxi Dress","linkUrl":"/images/search?img_url=https%3A%2F%2Fwww.lulus.com%2Fimages%2Fproduct%2Fyellow.jpg"},
        {"imageUrl":"//d","title":"Classic A Line V Neck Yellow Long Prom Dress with Split Front","linkUrl":"/images/search?img_url=https%3A%2F%2Fzapaka.ca%2Fcdn%2Fshop%2Fproducts%2Fyellow-slit.jpg"}
      ]}}</script>`);
    const ranked = YandexVisualSearch.candidates(thumbs, dress.images[0] ?? "");
    expect(ranked.map((thumb) => thumb.imageUrl)).toEqual([
      "https://www.lulus.com/images/product/yellow.jpg",
      "https://zapaka.ca/cdn/shop/products/yellow-slit.jpg",
    ]);
  });

  it("reads similar photos and prefers a real product page over spam", () => {
    const similar = YandexPageParser.similar(similarHtml);
    expect(similar).toHaveLength(2);
    expect(similar[0]?.imageUrl).toContain("zapaka.ca");
    const picked = SourcePagePicker.pick(YandexPageParser.sites(sitesHtml));
    expect(picked?.url).toBe("https://zapaka.ca/products/classic-a-line-v-neck-yellow-long-prom-dress-with-split-front");
    expect(SourcePagePicker.isResale("www.depop.com")).toBe(true);
  });

  it("resolves lookalike product pages and does not search the brand name", async () => {
    const image = dress.images[0] ?? "";
    const similarPage = YandexVisualSearch.pageUrl(image);
    const sitePage = YandexVisualSearch.pageUrl("https://zapaka.ca/cdn/shop/products/yellow-slit.jpg");
    const productPage = "https://zapaka.ca/products/classic-a-line-v-neck-yellow-long-prom-dress-with-split-front";
    const result = await VisualMatchFinder.search(
      dress,
      { size: "S", color: "yellow", maxPrice: 40 },
      transport({
        [similarPage]: similarHtml,
        [sitePage]: sitesHtml,
        [productPage]: `<meta property="og:type" content="product"><meta property="og:title" content="Classic A Line V Neck Yellow Long Prom Dress"><meta property="og:price:amount" content="22"><meta property="og:price:currency" content="USD"><img src="https://zapaka.ca/cdn/shop/products/yellow-slit.jpg">`,
      }),
    );
    expect(result.matchKind).toBe("visual");
    expect(result.listings.map((listing) => listing.url)).toEqual([
      "https://zapaka.ca/products/classic-a-line-v-neck-yellow-long-prom-dress-with-split-front",
    ]);
    expect(result.listings[0]?.price).toEqual({ amount: 22, currency: "USD" });
    expect(result.listings[0]?.thumbnailUrl).toContain("yellow-slit.jpg");
    expect(result.searchUrl.toLowerCase()).not.toContain("windsor");
    expect(result.notice.toLowerCase()).toContain("photo");
  });

  it("drops a page that does not contain the matched photo", () => {
    const html = `<meta property="og:type" content="product"><meta property="og:title" content="Other gown"><meta property="og:price:amount" content="30"><meta property="og:price:currency" content="USD"><img src="https://shop.example/cdn/other-gown.jpg">`;
    expect(
      ListingPageProof.confirm(html, "https://shop.example/products/other", "https://cdn.example/yellow-slit-dress.jpg", "Other"),
    ).toBeNull();
    const kept = ListingPageProof.confirm(
      `<meta property="og:type" content="product"><meta property="og:title" content="Yellow slit dress"><meta property="og:price:amount" content="30"><meta property="og:price:currency" content="USD"><img src="https://shop.example/cdn/yellow-slit-dress.jpg">`,
      "https://shop.example/products/yellow-slit-dress",
      "https://cdn.example/yellow-slit-dress.jpg",
      "Yellow slit dress",
    );
    expect(kept?.thumbnailUrl).toBe("https://shop.example/cdn/yellow-slit-dress.jpg");
    expect(kept?.price).toEqual({ amount: 30, currency: "USD" });
  });

  it("follows a product image file to its product page", async () => {
    const image = "https://cdn.example/photos/original-yellow.jpg";
    const lookalike = "https://static.dessy.com/s/i/product/v523/yellow.jpg";
    const result = await YandexVisualSearch.listings(
      image,
      transport({
        [YandexVisualSearch.pageUrl(image)]: `
          <script>{"cbirSimilar":{"thumbs":[
            {"imageUrl":"//avatars.mds.yandex.net/i?id=abc","title":"Pastel yellow chiffon dress","linkUrl":"/images/search?img_url=${encodeURIComponent(lookalike)}"}
          ]}}</script>`,
        [YandexVisualSearch.pageUrl(lookalike)]: `
          <script>{"cbirSites":{"sites":[
            {"title":"Pastel yellow chiffon dress","url":"https://www.dessy.com/products/pastel-yellow-chiffon-dress","domain":"dessy.com"}
          ]}}</script>`,
      }),
    );
    expect(result.map((listing) => listing.url)).toEqual(["https://www.dessy.com/products/pastel-yellow-chiffon-dress"]);
  });

  it("drops a different color and a price over the max", () => {
    const listings = VisualMatchFilters.apply(
      [
        {
          marketplace: "visual",
          title: "Black polka midi $80",
          url: "https://shop.example/products/black-midi",
          thumbnailUrl: null,
          price: { amount: 80, currency: "USD" },
          size: null,
          brand: null,
          source: "shop.example",
        },
        {
          marketplace: "visual",
          title: "Yellow slit gown $22",
          url: "https://shop.example/products/yellow-slit",
          thumbnailUrl: null,
          price: { amount: 22, currency: "USD" },
          size: null,
          brand: null,
          source: "shop.example",
        },
      ],
      { size: null, color: "yellow", maxPrice: 40 },
      dress,
    );
    expect(listings.map((listing) => listing.title)).toEqual(["Yellow slit gown $22"]);
  });

  it("parses Google Lens visual matches without inventing rows", () => {
    const listings = GoogleLensSearch.parse(
      JSON.stringify({
        visual_matches: [
          {
            title: "Yellow high slit dress",
            link: "https://www.depop.com/products/ana-yellow-slit/",
            source: "Depop",
            thumbnail: "https://media.example/thumb.jpg",
            price: { extracted_value: 28, currency: "USD" },
          },
        ],
      }),
    );
    expect(listings[0]).toMatchObject({
      url: "https://www.depop.com/products/ana-yellow-slit/",
      source: "depop",
      price: { amount: 28, currency: "USD" },
    });
    expect(GoogleLensSearch.parse("not json")).toEqual([]);
  });
});
