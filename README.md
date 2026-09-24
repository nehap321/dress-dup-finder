# Dress Dup Finder

A small web app for a student who wants a cheaper secondhand version of a brand dress.

Paste a product URL from a shop such as [Windsor](https://www.windsorstore.com) or [Princess Polly](https://us.princesspolly.com). Dress Dup reads the public product page (title, brand, color, and images when the page provides them). You set a size, color, and max price. The app then looks for similar listings on Depop.

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

Then add a size (for example `S` or `US 4`), a color, and a max price, and choose **Find Depop matches**.

```bash
npm test
npm run lint
```

No API keys are required. The app runs with the defaults below if you never create an env file.

## What you should see

1. A card for the brand dress: title, brand, color, image, and store price when the page includes them.
2. Depop result cards with title, price, thumbnail, and a link to that listing, **when Depop's search page is readable from the server**.
3. A clear **Open the live search** state when Depop refuses the request. The buttons are real Depop search URLs filled in from the dress title and your filters. They are not listings, and the app does not invent prices or photos.
4. A **No Depop matches** state when the search page loads but contains no listings.
5. A clear error if the product URL is private, missing, or not a product page.

## Environment

Copy `.env.example` to `.env.local` only if you want to change a default. Do not commit `.env.local`. There are no secrets in v1.

| Variable | Default | What it does |
| --- | --- | --- |
| `RATE_LIMIT_MS` | `1500` | Minimum gap between requests to the same host |
| `GLOBAL_RATE_LIMIT_MS` | `400` | Minimum gap between any outbound requests |
| `FETCH_TIMEOUT_MS` | `8000` | Timeout for one product or Depop request |
| `CACHE_TTL_MS` | `600000` | How long a successful response is reused |
| `DEPOP_COUNTRY` | `us` | Depop storefront prefix: `us`, `uk`, `au`, `eu`, `de`, `fr`, or `it` |
| `MAX_LISTINGS` | `12` | Cap when a live Depop page is readable (max 24) |

The rate limit and cache live in the server process. They reset when the dev server restarts.

## How v1 actually searches

Depop's [Selling API](https://partnerapi.depop.com/api-docs/) is private. It manages a seller's inventory and orders. It is not a public shopper search, and this project does not use it.

`https://www.depop.com/search/` and `https://webapi.depop.com` both returned **HTTP 403** to a normal server fetch while this app was built. Dress Dup does not try to get around that. It does not spoof a browser, send device IDs, solve challenges, or proxy through another IP.

Each search does two honest things:

1. It requests the brand page with a identifiable User-Agent (`DressDupFinder/1.0`) and the rate limit above.
2. It tries Depop's public search URL **once**. If the HTML contains listing data, those listings are shown. If Depop returns a block page, the app shows the same URL as a button so you can open it in your own browser.

A blocked response is cached for about a minute so repeated clicks do not hammer Depop.

Search links use Depop's public query parameters when they are known: `q`, `colours`, `sizes`, `priceMax`, `gender=female`, and `sort=priceAscending`. Size and color values are best-effort. `S` becomes `sizes=US-S`, and `US 4` becomes `sizes=US-4`. Depop may ignore a value it does not recognize, which is why every result also offers a broader search (brand + "dress" + color, without the size filter).

`gender=female` is always set because this app is for dresses. Take it off on Depop if you want a wider search.

## How product pages are read

For URLs that contain `/products/{handle}`, the app requests Shopify's public product JSON at `/products/{handle}.js`. That endpoint includes the title, vendor, color option, images, and price. On that endpoint, price is an integer number of cents (`997` is `9.97`). Currency comes from the shop's small public `/meta.json` file when it is available.

If that JSON is missing, the app reads the HTML page instead: schema.org `Product` JSON-LD first, then Open Graph tags (`og:title`, `og:image`, `product:price:amount`, and similar).

Only public `http` and `https` URLs are fetched. Localhost, link-local, and private network addresses are rejected so the form cannot be used as a request proxy. Responses are capped at about 3 MB.

## Adding another marketplace

eBay and OfferUp are intentionally not implemented. To add one later:

1. Create a class next to `src/lib/marketplaces/DepopMarketplace.ts` with static `id`, `label`, and `search(product, filters)`.
2. Return a `MarketplaceSearchResult`: real listings, or `mode: "unavailable"` with an honest search link. Do not fill cards with placeholder prices.
3. Register the class in `MarketplaceRegistry.providers()`.

The home page renders every provider the registry returns.

## Limits

- This is a personal lookup tool, not a crawler. One dress at a time.
- Brand sites can change their HTML, block automated requests, or show a different price by region.
- Depop's terms restrict scraping and automated access. v1 prefers a link-out when the site refuses a server fetch. You are responsible for using Depop within their terms.
- Live listing cards appear only from data Depop actually returned. If you only see **Open the live search**, that is the current v1 behavior, not a failed deploy.
- Color and size filters are translated from the words you type. Unusual size labels are kept in the search text and left out of the `sizes` parameter.
- Original-store currency is shown only when the page states it.

## License

[MIT](LICENSE)
