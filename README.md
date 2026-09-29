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

Size and max price are optional. Choose **Find a similar look**. If the page has several colors, pick one. Or open **By dress type** and type something like `blue mini dress`.

```bash
npm test
npm run lint
```

No API keys are required. The app runs with the defaults below if you never create an env file.

## What you should see

1. A card for the brand dress: title, brand, color, image, and store price when the page includes them.
2. If that page lists more than one color, buttons for those colors. The search waits until you pick one.
3. Cards only when the listing page contains the matched photo and states a price. Each card shows that photo and the price.
4. A **By dress type** tab for words such as `blue mini dress`. It asks Depop, Poshmark, and eBay separately, and sorts closer title matches that cost less first.
5. A clear error if the product URL is private, missing, or not a product page. The previous dress card is cleared.

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
3. If the key is unset, or Lens returns nothing, the photo is sent to Yandex Images' public reverse-image page (`https://yandex.com/images/search?rpt=imageview&url=...`). Node's HTTP client is often redirected to a Yandex captcha on that page, so the server reads it with `curl` and the same identifiable user agent. It does not solve captchas.
4. Each candidate page is opened. The card is kept only when that page's HTML contains the matched photo file and a price. The thumbnail is that listing's own image, not a search-engine preview. Pages that fail the check are counted in the notice and not shown.
5. Size and max price are optional. Color is taken from the product page. A title that names a different color is dropped. A listing with no written size is kept.

## Dress type search

The second tab sends your words to three places. The brand name is not added.

| Place | What this server can read |
| --- | --- |
| Depop | The public search URL. It usually returns HTTP 403. The tab says so and does not invent cards. |
| Poshmark | The public `vm-rest/posts` feed, after a normal visit that sets cookies. Cards use each listing's cover photo and `price_amount`. |
| eBay | eBay search returns HTTP 403 from this server. Cards are then read from [PicClick](https://picclick.com/)'s public eBay index: item number, photo, and price, linking to `ebay.com/itm/{id}`. |

Results are sorted by how many of your words are in the title, then by price, lowest first. A card still needs both a photo and a price.

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
