import type { IndexedPage } from "./YandexPageParser";

const RESALE_HOSTS = [
  "depop.com",
  "poshmark.com",
  "poshmark.ca",
  "vinted.com",
  "vinted.co.uk",
  "vinted.fr",
  "mercari.com",
  "ebay.com",
  "ebay.co.uk",
  "thredup.com",
  "vestiairecollective.com",
  "grailed.com",
  "therealreal.com",
  "offerup.com",
];

const SPAM_HOSTS = new Set([
  "alupunch.com.tr",
  "searchagora.com",
  "kidssunnah.com",
  "syncro-system.cl",
  "forent.com.tr",
  "megamotor.com.co",
  "imall.com",
  "daralnahda.com",
]);

export class SourcePagePicker {
  static pick(pages: IndexedPage[], imageHost = ""): IndexedPage | null {
    let best: IndexedPage | null = null;
    let bestScore = 0;
    for (const page of pages) {
      const score = SourcePagePicker.score(page, imageHost);
      if (score > bestScore) {
        best = page;
        bestScore = score;
      }
    }
    return bestScore >= 40 ? best : null;
  }

  static cleanUrl(raw: string): string {
    try {
      const url = new URL(raw);
      for (const key of [...url.searchParams.keys()]) {
        if (/^(utm_|yclid$|gclid$|fbclid$)/i.test(key)) url.searchParams.delete(key);
      }
      return url.toString();
    } catch {
      return raw;
    }
  }

  static isResale(hostname: string): boolean {
    const host = hostname.replace(/^www\./, "").toLowerCase();
    return RESALE_HOSTS.some((resale) => host === resale || host.endsWith(`.${resale}`));
  }

  static isImageHost(hostname: string): boolean {
    const host = hostname.replace(/^www\./, "").toLowerCase();
    return (
      host === "cdn.shopify.com" ||
      host.endsWith("pinimg.com") ||
      host.includes("alicdn.com") ||
      host.endsWith("cloudfront.net") ||
      host.endsWith("yandex.net") ||
      host.endsWith("yandex.ru") ||
      host.endsWith("yandex.com") ||
      host.endsWith("gstatic.com") ||
      host.endsWith("googleusercontent.com") ||
      host.endsWith("ztat.net") ||
      host.includes("joomcdn") ||
      host.includes("milledcdn") ||
      host.endsWith("pho.to")
    );
  }

  private static score(page: IndexedPage, imageHost: string): number {
    let host = "";
    try {
      host = new URL(page.url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return -1;
    }
    if (SPAM_HOSTS.has(host) || SPAM_HOSTS.has(page.domain.replace(/^www\./, "").toLowerCase())) return -1;
    if (/gweb\.aspx|cweb\.aspx|did\.aspx|did\.asp|fox\.aspx|wsea\.php/i.test(page.url)) return -1;
    if (/[?&](?:m|k|x)=/i.test(page.url)) return -1;
    if (SourcePagePicker.isImageHost(host)) return -1;
    let score = 0;
    if (SourcePagePicker.isResale(host)) score += 80;
    if (SourcePagePicker.isProductPath(page.url)) score += 40;
    if (/dress|gown|jumpsuit|romper|платье/i.test(`${page.title} ${page.url}`)) score += 15;
    if (SourcePagePicker.sameShop(host, imageHost)) score += 20;
    if (host.includes("pinterest.")) score -= 25;
    if (/\/(?:categories|blog|collections)\//i.test(page.url) && !/\/products?\//i.test(page.url)) score -= 30;
    return score;
  }

  private static isProductPath(url: string): boolean {
    return /\/products?\//i.test(url) || /\/itm\/|\/listing\/|\/item\//i.test(url) || /\/p\d{5,}(?:[/?]|$)/i.test(url) || /\/dp\//i.test(url);
  }

  private static sameShop(pageHost: string, imageHost: string): boolean {
    const image = imageHost.replace(/^www\./, "").toLowerCase();
    if (!image) return false;
    return pageHost === image || pageHost.endsWith(`.${image}`) || image.endsWith(`.${pageHost}`);
  }
}
