"use client";

import type { MarketplaceSearchResult } from "@/lib/marketplaces/Listing";
import type { MatchResponse } from "@/lib/match/MatchService";
import type { ProductInfo } from "@/lib/product/ProductInfo";
import { TextFormat } from "@/lib/product/TextFormat";
import { FormEvent, useState } from "react";

const SAMPLES = [
  {
    name: "Windsor",
    detail: "Yellow formal dress",
    url: "https://www.windsorstore.com/products/polly-formal-high-slit-dress-050020089999",
    size: "S",
    color: "yellow",
    maxPrice: "40",
  },
  {
    name: "Princess Polly",
    detail: "Polka-dot midi",
    url: "https://us.princesspolly.com/products/down-with-love-asymmetrical-midi-dress-black-white-polka",
    size: "US 4",
    color: "black",
    maxPrice: "50",
  },
];

export function Finder() {
  const [url, setUrl] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [results, setResults] = useState<MarketplaceSearchResult[]>([]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setProduct(null);
    setResults([]);
    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          size: size.trim() || null,
          color: color.trim() || null,
          maxPrice: maxPrice.trim() === "" ? null : Number(maxPrice),
        }),
      });
      const payload = (await response.json()) as MatchResponse;
      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }
      setProduct(payload.product);
      setResults(payload.results);
    } catch {
      setError("The search didn't finish. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className="panel" onSubmit={onSubmit}>
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
        <div className="filters">
          <label className="field">
            <span>Size</span>
            <input
              name="size"
              placeholder="S or US 4"
              value={size}
              onChange={(event) => setSize(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Color</span>
            <input
              name="color"
              placeholder="black"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Max price</span>
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
          {loading ? "Comparing the photo…" : "Find a similar look"}
        </button>
        <p className="hint" role="status">
          {loading
            ? "Reading the dress photo, then searching for pictures that look like it."
            : "Matches come from the photo. A brand-name search is not the result."}
        </p>
        <div className="samples">
          {SAMPLES.map((sample) => (
            <button
              key={sample.url}
              className="sample"
              type="button"
              onClick={() => {
                setUrl(sample.url);
                setSize(sample.size);
                setColor(sample.color);
                setMaxPrice(sample.maxPrice);
              }}
            >
              <strong>{sample.name}</strong>
              <span className="sample-detail">{sample.detail}</span>
            </button>
          ))}
        </div>
      </form>

      {error ? (
        <div className="alert" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      {product ? <ProductSummary product={product} /> : null}
      {results.map((result) => (
        <MarketplaceResult key={result.marketplace} result={result} />
      ))}

      <details className="why">
        <summary>How the photo match works</summary>
        <p>
          The dress photo is sent to a reverse-image search. Google Lens is used when a SerpAPI key
          is set. Otherwise Yandex Images&apos; public photo search is used. Results stay in the
          order of visual similarity. Depop does not offer a public photo search, and this app does
          not invent Depop listings when a lookalike isn&apos;t in the image index.
        </p>
      </details>
    </>
  );
}

function resultHeading(result: MarketplaceSearchResult): string {
  if (result.mode === "unavailable") return "Couldn't compare the photo";
  if (result.listings.length === 0) return "No visual matches";
  return "Dresses that look like this";
}

function ProductSummary({ product }: { product: ProductInfo }) {
  const image = product.images[0];
  const price = product.price
    ? `${product.priceVaries ? "From " : ""}${TextFormat.formatMoney(product.price.amount, product.price.currency)}`
    : null;
  return (
    <article className="product">
      {image ? (
        // Brand and Depop image hosts are not known ahead of time, so this stays a plain image.
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
          {price ? <li>{product.price?.currency ? price : `Listed at ${price}`}</li> : null}
        </ul>
        <a className="outbound" href={product.sourceUrl} target="_blank" rel="noopener noreferrer">
          View original listing
        </a>
      </div>
    </article>
  );
}

function MarketplaceResult({ result }: { result: MarketplaceSearchResult }) {
  return (
    <section className="result-block">
      <p className="kicker">{result.label}</p>
      <h2>{resultHeading(result)}</h2>
      <p className="notice">{result.notice}</p>
      {result.mode === "listings" && result.listings.length > 0 ? (
        <>
          <ul className="listings">
            {result.listings.map((listing) => (
              <li key={listing.url}>
                <a className="listing" href={listing.url} target="_blank" rel="noopener noreferrer">
                {listing.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="thumb" src={listing.thumbnailUrl} alt="" />
                ) : (
                    <div className="thumb placeholder">No photo</div>
                  )}
                  <div>
                    <h3>{listing.title}</h3>
                    <p className="price">
                      {listing.price
                        ? TextFormat.formatMoney(listing.price.amount, listing.price.currency)
                        : "Price on the listing"}
                    </p>
                    <p className="meta">{listing.source ?? "Similar photo"}</p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <details className="why">
        <summary>Keyword search on Depop, last resort</summary>
        <p>
          This ignores the photo and searches words only. The brand name is left out. It is not a
          visual match.
        </p>
        <a className="outbound" href={result.searchUrl} target="_blank" rel="noopener noreferrer">
          Open word search
        </a>
      </details>
    </section>
  );
}
