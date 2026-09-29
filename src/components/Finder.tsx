"use client";

import type { MarketplaceSearchResult } from "@/lib/marketplaces/Listing";
import type { MatchResponse } from "@/lib/match/MatchService";
import type { ProductInfo } from "@/lib/product/ProductInfo";
import { TextFormat } from "@/lib/product/TextFormat";
import { FormEvent, useState } from "react";

const PHOTO_SAMPLES = [
  {
    name: "Windsor",
    detail: "One color, yellow",
    url: "https://www.windsorstore.com/products/polly-formal-high-slit-dress-050020089999",
    size: "S",
    maxPrice: "40",
  },
  {
    name: "Windsor floral",
    detail: "Black, brown, or blue",
    url: "https://www.windsorstore.com/products/grandeur-blooms-strapless-slit-floral-maxi-dress-051013386001",
    size: "",
    maxPrice: "",
  },
];

export function Finder() {
  const [mode, setMode] = useState<"photo" | "words">("photo");
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("blue mini dress");
  const [size, setSize] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [awaitingColor, setAwaitingColor] = useState(false);
  const [results, setResults] = useState<MarketplaceSearchResult[]>([]);

  async function search(next: { mode: "photo" | "words"; color?: string | null }) {
    setLoading(true);
    setError(null);
    setResults([]);
    if (next.mode === "words") setAwaitingColor(false);
    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: next.mode,
          url: next.mode === "photo" ? url : null,
          query: next.mode === "words" ? query : null,
          size: size.trim() || null,
          color: next.color ?? null,
          maxPrice: maxPrice.trim() === "" ? null : Number(maxPrice),
        }),
      });
      const payload = (await response.json()) as MatchResponse;
      if (!payload.ok) {
        setProduct(null);
        setAwaitingColor(false);
        setError(payload.error.message);
        return;
      }
      setProduct(payload.product);
      if (payload.step === "color") {
        setAwaitingColor(true);
        setColor(null);
        return;
      }
      setAwaitingColor(false);
      setResults(payload.results);
    } catch {
      setError("The search didn't finish. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAwaitingColor(false);
    void search({ mode, color: null });
  }

  return (
    <>
      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={mode === "photo" ? "tab active" : "tab"}
          aria-selected={mode === "photo"}
          onClick={() => {
            setMode("photo");
            setError(null);
            setResults([]);
            setAwaitingColor(false);
          }}
        >
          From a dress link
        </button>
        <button
          type="button"
          role="tab"
          className={mode === "words" ? "tab active" : "tab"}
          aria-selected={mode === "words"}
          onClick={() => {
            setMode("words");
            setError(null);
            setResults([]);
            setProduct(null);
            setAwaitingColor(false);
          }}
        >
          By dress type
        </button>
      </div>

      <form className="panel" onSubmit={onSubmit}>
        {mode === "photo" ? (
          <label className="field">
            <span>Product URL</span>
            <input
              name="url"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://www.windsorstore.com/products/…"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
            />
          </label>
        ) : (
          <label className="field">
            <span>Dress type</span>
            <input
              name="query"
              placeholder="blue mini dress"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              required
            />
          </label>
        )}
        <div className="filters">
          <label className="field">
            <span>Size (optional)</span>
            <input
              name="size"
              placeholder="S or US 4"
              value={size}
              onChange={(event) => setSize(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Max price (optional)</span>
            <input
              name="maxPrice"
              type="number"
              inputMode="decimal"
              min={0}
              step="1"
              placeholder="40"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
            />
          </label>
        </div>
        <button className="submit" type="submit" disabled={loading}>
          {loading ? "Looking…" : mode === "photo" ? "Find a similar look" : "Search secondhand"}
        </button>
        <p className="hint" role="status">
          {mode === "photo"
            ? "Color comes from the product page. A card appears only when that listing shows the dress and a price."
            : "Words only, like blue mini dress. Brand names are not added. Depop, Poshmark, and eBay are searched separately."}
        </p>
        {mode === "photo" ? (
          <div className="samples">
            {PHOTO_SAMPLES.map((sample) => (
              <button
                key={sample.url}
                className="sample"
                type="button"
                onClick={() => {
                  setUrl(sample.url);
                  setSize(sample.size);
                  setMaxPrice(sample.maxPrice);
                  setColor(null);
                  setAwaitingColor(false);
                }}
              >
                <strong>{sample.name}</strong>
                <span className="sample-detail">{sample.detail}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="samples">
            {["blue mini dress", "red / blue / gold / purple mini dress"].map((sample) => (
              <button key={sample} className="sample" type="button" onClick={() => setQuery(sample)}>
                <strong>{sample}</strong>
              </button>
            ))}
          </div>
        )}
      </form>

      {error ? (
        <div className="alert" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      {product ? <ProductSummary product={product} /> : null}

      {awaitingColor && product && product.colors.length > 1 ? (
        <section className="result-block">
          <p className="kicker">Color on this page</p>
          <h2>Which color?</h2>
          <p className="notice">This dress comes in more than one color. Pick one. You do not have to guess.</p>
          <div className="colors">
            {product.colors.map((option) => (
              <button
                key={option.name}
                type="button"
                className={color === option.name ? "color-choice active" : "color-choice"}
                disabled={loading}
                onClick={() => {
                  setColor(option.name);
                  void search({ mode: "photo", color: option.name });
                }}
              >
                {option.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={option.images[0]} alt="" />
                ) : null}
                <span>{option.name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {results.map((result) => (
        <MarketplaceResult key={result.marketplace} result={result} words={mode === "words"} />
      ))}

      <details className="why">
        <summary>How matching works</summary>
        <p>
          From a link, the color options are read off the product page. The dress photo is compared
          with a reverse-image search, and a card is kept only when that listing page contains the
          matched photo and states a price. By dress type, the words are sent to Depop, Poshmark,
          and eBay. If a site blocks the server, that section says so instead of inventing listings.
        </p>
      </details>
    </>
  );
}

function resultHeading(result: MarketplaceSearchResult, words: boolean): string {
  if (!words) {
    if (result.mode === "unavailable") return "Couldn't compare the photo";
    if (result.listings.length === 0) return "No visual matches";
    return "Dresses that look like this";
  }
  if (result.listings.length === 0) return `No ${result.label} listings`;
  return result.label;
}

function ProductSummary({ product }: { product: ProductInfo }) {
  const image = product.images[0];
  const price = product.price
    ? `${product.priceVaries ? "From " : ""}${TextFormat.formatMoney(product.price.amount, product.price.currency)}`
    : null;
  return (
    <article className="product">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" />
      ) : (
        <div className="thumb placeholder">No photo</div>
      )}
      <div>
        <p className="kicker">From the brand page</p>
        <h2>{product.title}</h2>
        <ul className="facts">
          {product.brand ? <li>{product.brand}</li> : null}
          {product.color ? <li>{product.color}</li> : null}
          {product.colors.length > 1 && !product.color ? <li>{product.colors.length} colors</li> : null}
          {price ? <li>{price}</li> : null}
        </ul>
        <a className="outbound" href={product.sourceUrl} target="_blank" rel="noopener noreferrer">
          View original listing
        </a>
      </div>
    </article>
  );
}

function MarketplaceResult({ result, words }: { result: MarketplaceSearchResult; words: boolean }) {
  const cards = result.listings.filter((listing) => listing.thumbnailUrl && listing.price);
  return (
    <section className="result-block">
      <p className="kicker">{result.label}</p>
      <h2>{resultHeading(result, words)}</h2>
      <p className="notice">{result.notice}</p>
      {cards.length > 0 ? (
        <ul className="listings">
          {cards.map((listing) => (
            <li key={listing.url}>
              <a className="listing" href={listing.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="thumb" src={listing.thumbnailUrl ?? ""} alt="" />
                <div>
                  <h3>{listing.title}</h3>
                  <p className="price">{TextFormat.formatMoney(listing.price?.amount ?? 0, listing.price?.currency ?? null)}</p>
                  <p className="meta">
                    {listing.source ?? result.label}
                    {listing.size ? ` · ${listing.size}` : ""}
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {words && result.mode === "unavailable" ? (
        <a className="outbound" href={result.searchUrl} target="_blank" rel="noopener noreferrer">
          Open {result.label}
        </a>
      ) : null}
    </section>
  );
}
