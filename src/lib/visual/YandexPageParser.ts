import { JsonValue } from "../product/JsonValue";
import { TextFormat } from "../product/TextFormat";

export type SimilarThumb = {
  title: string;
  thumbnailUrl: string;
  imageUrl: string;
  rank: number;
};

export type IndexedPage = {
  title: string;
  url: string;
  domain: string;
};

export class YandexPageParser {
  static similar(html: string): SimilarThumb[] {
    if (YandexPageParser.blocked(html)) return [];
    const block = YandexPageParser.objectAfter(html, '"cbirSimilar":');
    const thumbs = JsonValue.record(block)?.thumbs;
    if (!Array.isArray(thumbs)) return [];
    const similar: SimilarThumb[] = [];
    thumbs.forEach((thumb, index) => {
      const record = JsonValue.record(thumb);
      const title = record ? TextFormat.cleanLine(JsonValue.string(record.title) ?? "") : "";
      const link = record ? JsonValue.string(record.linkUrl) : null;
      const imageUrl = link ? YandexPageParser.imageFromLink(link) : null;
      const thumbUrl = record ? YandexPageParser.absolute(JsonValue.string(record.imageUrl)) : null;
      if (!title || !imageUrl || !thumbUrl) return;
      similar.push({ title, thumbnailUrl: thumbUrl, imageUrl, rank: index });
    });
    return similar;
  }

  static sites(html: string): IndexedPage[] {
    if (YandexPageParser.blocked(html)) return [];
    const block = YandexPageParser.objectAfter(html, '"cbirSites":');
    const sites = JsonValue.record(block)?.sites;
    if (!Array.isArray(sites)) return [];
    const pages: IndexedPage[] = [];
    for (const site of sites) {
      const record = JsonValue.record(site);
      const url = record ? JsonValue.string(record.url) : null;
      const title = record ? TextFormat.cleanLine(JsonValue.string(record.title) ?? "") : "";
      const domain = record ? JsonValue.string(record.domain) : null;
      if (!url || !title || !/^https?:\/\//i.test(url)) continue;
      pages.push({ title, url, domain: (domain ?? YandexPageParser.host(url) ?? "").replace(/^www\./, "") });
    }
    return pages;
  }

  static blocked(html: string): boolean {
    const head = html.slice(0, 4000).toLowerCase();
    return head.includes("smartcaptcha") || head.includes("showcaptcha") || head.includes("are you not a robot");
  }

  private static imageFromLink(linkUrl: string): string | null {
    try {
      const url = new URL(linkUrl, "https://yandex.com");
      const image = url.searchParams.get("img_url");
      if (!image || !/^https?:\/\//i.test(image)) return null;
      return image;
    } catch {
      return null;
    }
  }

  private static absolute(value: string | null): string | null {
    if (!value) return null;
    if (value.startsWith("//")) return `https:${value}`;
    return /^https?:\/\//i.test(value) ? value : null;
  }

  private static host(value: string): string | null {
    try {
      return new URL(value).hostname;
    } catch {
      return null;
    }
  }

  private static objectAfter(html: string, key: string): unknown | null {
    const text = TextFormat.decodeEntities(html);
    const found = text.indexOf(key);
    if (found < 0) return null;
    const start = text.indexOf("{", found + key.length);
    if (start < 0) return null;
    const end = YandexPageParser.matchObject(text, start);
    if (end < 0) return null;
    try {
      return JSON.parse(text.slice(start, end + 1)) as unknown;
    } catch {
      return null;
    }
  }

  private static matchObject(text: string, start: number): number {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) return index;
      }
    }
    return -1;
  }
}
