# Dress Dup Finder

A small web app for a student who wants a cheaper secondhand version of a brand dress.

Paste a product URL from a shop such as [Windsor](https://www.windsorstore.com) or [Princess Polly](https://us.princesspolly.com). Dress Dup reads the public product photo and looks for other dresses with a similar silhouette, neckline, sleeve, slit, or pattern. Size, color, and max price only narrow that visual match. The brand name is not the search.

There are no accounts and no payments. Photo search, eBay, and OfferUp are not in v1.

## Run it locally

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Try a sample button, or paste one of these real product links:

- `https://www.windsorstore.com/products/polly-formal-high-slit-dress-050020089999`
- `https://us.princesspolly.com/products/down-with-love-asymmetrical-midi-dress-black-white-polka`

Then add a size (for example `S` or `US 4`), a color, and a max price, and choose **Find a similar look**.

```bash
npm test
npm run lint
```

No API keys are required. The app runs with the defaults below if you never create an env file.

## What you should see

1. A card for the brand dress: title, brand, color, image, and store price when the page includes them.
2. Cards for dresses that look like the photo: title, source site, thumbnail, price when the page states one, and a link to that product page. Ordered by visual similarity.
3. A clear **No visual matches** state when the reverse-image search returns nothing useful. No prices or photos are invented.
4. A collapsed **Keyword search on Depop, last resort** link. It searches style words from the title and leaves the brand name out. It is not the result.
5. A clear error if the product URL is private, missing, or not a product page.

## Environment

Copy `.env.example` to `.env.local` only if you want to change a default. Do not commit `.env.local`. There are no secrets in v1.

| Variable | Default | What it does |
| --- | --- | --- |
| `RATE_LIMIT_MS` | `1500` | Minimum gap between requests to the same host |
| `GLOBAL_RATE_LIMIT_MS` | `400` | Minimum gap between any outbound requests |
| `FETCH_TIMEOUT_MS` | `8000` | Timeout for one product or Depop request |
| `CACHE_TTL_MS` | `600000` | How long a successful response is reused |
| `SERPAPI_API_KEY` | empty | Optional. Google Lens visual matches via SerpAPI. When empty, Yandex Images is used |
| `DEPOP_COUNTRY` | `us` | Storefront prefix for the last-resort Depop word search: `us`, `uk`, `au`, `eu`, `de`, `fr`, or `it` |
| `MAX_LISTINGS` | `12` | Cap for a direct Depop page parse if that page is ever readable (max 24) |

The rate limit and cache live in the server process. They reset when the dev server restarts.

## How visual matching works

Depop's [Selling API](https://partnerapi.depop.com/api-docs/) is private. It manages a seller's inventory and orders. It is not a photo search, and this project does not use it. Depop's public search pages returned **HTTP 403** to a normal server fetch. Dress Dup does not bypass that, and it does not invent Depop HTML.

The match is the dress photo:

1. The brand page is read for its images (Shopify `/products/{handle}.js`, then JSON-LD / Open Graph).
2. If `SERPAPI_API_KEY` is set, that photo is sent to [SerpAPI's Google Lens API](https://serpapi.com/google-lens-api) with `type=visual_matches`. Those are the results.
3. If the key is unset, or Lens returns nothing, the photo is sent to Yandex Images' public reverse-image page (`https://yandex.com/images/search?rpt=imageview&url=...`). The similar-photo list is visual, not a brand keyword. Node's HTTP client is often redirected to a Yandex captcha on that page, so the server reads it with `curl` and the same identifiable user agent. It does not solve captchas or pretend to be a browser. Boards, image-only CDNs, and doorway titles are skipped. For the next lookalikes, the app reads which real product page Yandex attaches and keeps that page. Spam doorway sites and category indexes are dropped. Resale hosts such as Depop, Poshmark, Vinted, eBay, and ThredUp are preferred when they actually appear.
4. Your size, color, and max price then remove a card only when that listing states a conflicting value. A photo with no written size is kept, because the size is not in the picture.
5. A Depop word-search link is still built from the dress style (slit, midi, polka, and so on) plus color. The brand name is removed. It sits behind **Keyword search on Depop, last resort** and is never the main result.

A search can take a little while: one request for the dress, one for the similar-photo list, then up to eight page lookups, with the rate limit above. Successful responses are cached.

## How product pages are read

For URLs that contain `/products/{handle}`, the app requests Shopify's public product JSON at `/products/{handle}.js`. That endpoint includes the title, vendor, color option, images, and price. On that endpoint, price is an integer number of cents (`997` is `9.97`). Currency comes from the shop's small public `/meta.json` file when it is available.

If that JSON is missing, the app reads the HTML page instead: schema.org `Product` JSON-LD first, then Open Graph tags (`og:title`, `og:image`, `product:price:amount`, and similar).

Only public `http` and `https` URLs are fetched. Localhost, link-local, and private network addresses are rejected so the form cannot be used as a request proxy. Responses are capped at about 3 MB.

## Adding another marketplace

eBay and OfferUp are not separate keyword searches. Another visual provider can be added beside `src/lib/visual/YandexVisualSearch.ts` and `GoogleLensSearch.ts`, then used from `VisualMatchFinder`. `MarketplaceRegistry` currently returns that visual finder only. Do not fill cards with placeholder prices.

## Limits

- This is a personal lookup tool, not a crawler. One dress at a time.
- Visual results are whatever the image index actually returns. Depop, Poshmark, and other resale sites appear only when that index has a lookalike page. Many matches are other retailers with a similar dress. That is a photo match, not a brand match.
- Yandex's public image search can change its HTML, add a captcha, or omit product pages. When that happens the app shows **No visual matches** or **Couldn't compare the photo** instead of guessing.
- SerpAPI Google Lens is optional and paid. Without `SERPAPI_API_KEY` the app does not call it.
- Depop's terms restrict scraping and automated access. The word-search link is a last resort you open yourself.
- Max price filters prices marked in USD or with `$`. A price in another currency is shown and not compared. Size is filtered only when the listing states a conflicting size.
- Original-store currency is shown only when the page states it.

## License

[MIT](LICENSE)
