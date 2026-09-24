export class TextFormat {
  static cleanLine(value: string): string {
    return TextFormat.decodeEntities(value)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  static decodeEntities(value: string): string {
    return value
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
      .replace(/&#x([0-9a-f]+);/gi, (_, digits: string) => String.fromCodePoint(parseInt(digits, 16)));
  }

  static titleCaseWords(value: string): string {
    return value
      .toLowerCase()
      .split(/(\s+|[/-])/)
      .map((part) => (/^[a-z]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
      .join("");
  }

  static displayBrand(value: string): string {
    const clean = TextFormat.cleanLine(value);
    if (!clean || clean.length <= 4 || clean !== clean.toUpperCase()) return clean;
    return TextFormat.titleCaseWords(clean);
  }

  static displayColor(value: string): string {
    const clean = TextFormat.cleanLine(value);
    if (!clean) return clean;
    if (clean !== clean.toUpperCase()) return clean;
    return TextFormat.titleCaseWords(clean);
  }

  static clamp(value: string, max: number): string {
    const clean = value.replace(/\s+/g, " ").trim();
    if (clean.length <= max) return clean;
    const cut = clean.slice(0, max);
    const space = cut.lastIndexOf(" ");
    return (space > 40 ? cut.slice(0, space) : cut).trim();
  }

  static formatMoney(amount: number, currency: string | null): string {
    if (!Number.isFinite(amount)) return "";
    if (currency) {
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        return `${amount.toFixed(2)} ${currency}`;
      }
    }
    return amount.toFixed(2);
  }

  static absoluteHttpUrl(value: string, base: string): string | null {
    try {
      const withProtocol = value.startsWith("//") ? `https:${value}` : value;
      const url = new URL(withProtocol, base);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return url.toString();
    } catch {
      return null;
    }
  }
}
