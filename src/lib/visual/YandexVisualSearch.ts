import { CurlPage } from "../http/CurlPage";
import type { FetchedPage, PageTransport } from "../http/PageTransport";
import { SafeFetch } from "../http/SafeFetch";
import type { Listing } from "../marketplaces/Listing";
import { PriceMention } from "./PriceMention";
import { SourcePagePicker } from "./SourcePagePicker";
import { YandexPageParser, type SimilarThumb } from "./YandexPageParser";

export class YandexVisualSearch {
  static readonly provider = "Yandex Images";
  private static readonly lookups = 8;

  static pageUrl(imageUrl: string): string {
    const url = new URL("https://yandex.com/images/search");
    url.searchParams.set("rpt", "imageview");
    url.searchParams.set("url", imageUrl);
    return url.toString();
  }

  static candidates(thumbs: SimilarThumb[], originalImageUrl: string): SimilarThumb[] {
    const kept: SimilarThumb[] = [];
    for (const thumb of thumbs) {
      if (YandexVisualSearch.samePhoto(thumb.imageUrl, originalImageUrl)) continue;
      if (YandexVisualSearch.isJunk(thumb)) continue;
      kept.push(thumb);
      if (kept.length >= YandexVisualSearch.lookups) break;
    }
    return kept;
  }

  static async listings(imageUrl: string, transport: PageTransport): Promise<Listing[]> {
    const page = await YandexVisualSearch.read(YandexVisualSearch.pageUrl(imageUrl), transport);
    if (page.status >= 400 || YandexPageParser.blocked(page.body)) return [];
    const listings: Listing[] = [];
    for (const thumb of YandexVisualSearch.candidates(YandexPageParser.similar(page.body), imageUrl)) {
      const listing = await YandexVisualSearch.resolve(thumb, transport);
      if (listing) listings.push(listing);
    }
    return listings;
  }

  private static async resolve(thumb: SimilarThumb, transport: PageTransport): Promise<Listing | null> {
    let host = "";
    try {
      host = new URL(thumb.imageUrl).hostname;
    } catch {
      return null;
    }
    let pageUrl = thumb.imageUrl;
    let title = thumb.title;
    let domain = host.replace(/^www\./, "");
    if (YandexVisualSearch.needsSourcePage(thumb.imageUrl)) {
      const sitesPage = await YandexVisualSearch.read(YandexVisualSearch.pageUrl(thumb.imageUrl), transport);
      if (sitesPage.status >= 400 || YandexPageParser.blocked(sitesPage.body)) return null;
      const picked = SourcePagePicker.pick(YandexPageParser.sites(sitesPage.body), host);
      if (!picked) return null;
      pageUrl = SourcePagePicker.cleanUrl(picked.url);
      title = picked.title || thumb.title;
      domain = picked.domain || domain;
    }
    if (YandexVisualSearch.isImageFile(pageUrl)) return null;
    return {
      marketplace: "visual",
      title,
      url: pageUrl,
      thumbnailUrl: thumb.imageUrl,
      price: PriceMention.fromTitle(title),
      size: null,
      brand: null,
      source: domain,
    };
  }

  private static async read(url: string, transport: PageTransport): Promise<FetchedPage> {
    if (transport === SafeFetch) return CurlPage.get(url);
    return transport.get(url);
  }

  private static isImageFile(value: string): boolean {
    try {
      return /\.(?:jpe?g|png|webp|gif|avif)$/i.test(new URL(value).pathname);
    } catch {
      return false;
    }
  }

  private static needsSourcePage(imageUrl: string): boolean {
    try {
      const url = new URL(imageUrl);
      if (SourcePagePicker.isImageHost(url.hostname)) return true;
      if (/\.(?:jpe?g|png|webp|gif|avif)(?:$|\?)/i.test(url.pathname)) return true;
      if (/\/cdn\/|\/images?\//i.test(url.pathname)) return true;
      return !/\/products?\//i.test(url.pathname);
    } catch {
      return true;
    }
  }

  private static isJunk(thumb: SimilarThumb): boolean {
    let host = "";
    try {
      host = new URL(thumb.imageUrl).hostname;
    } catch {
      return true;
    }
    if (SourcePagePicker.isImageHost(host)) return true;
    if (/pinterest\.|pinimg\./i.test(host)) return true;
    if (/\bideas\b/i.test(thumb.title) && /\d/.test(thumb.title)) return true;
    if (/cheap sell|hotsell|off\s*-?\s*\d+|flash sales/i.test(thumb.title)) return true;
    return false;
  }

  private static samePhoto(candidate: string, original: string): boolean {
    return YandexVisualSearch.stem(candidate) === YandexVisualSearch.stem(original);
  }

  private static stem(value: string): string {
    try {
      const url = new URL(value);
      const path = url.pathname.replace(
        /_(?:\d+x\d*|\d*x\d+|grande|large|small|compact|master)(?=\.)/gi,
        "",
      );
      return `${url.hostname}${path}`.toLowerCase();
    } catch {
      return value.toLowerCase();
    }
  }
}
