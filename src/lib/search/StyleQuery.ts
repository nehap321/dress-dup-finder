export class StyleQuery {
  private static readonly generic = new Set(["dress", "dresses", "gown", "gowns", "womens", "women", "woman", "for", "and", "the", "with", "size"]);

  static text(raw: string): string {
    return StyleQuery.words(raw).join(" ");
  }

  static words(raw: string): string[] {
    const words: string[] = [];
    for (const part of raw.toLowerCase().split(/[^a-z0-9]+/)) {
      if (part.length < 2 || words.includes(part)) continue;
      words.push(part);
      if (words.length >= 12) break;
    }
    return words;
  }

  static relevant(title: string, words: string[]): boolean {
    const specific = words.filter((word) => !StyleQuery.generic.has(word));
    if (specific.length === 0) return true;
    const hay = title.toLowerCase();
    return specific.some((word) => hay.includes(word));
  }

  static closeness(title: string, words: string[]): number {
    const hay = title.toLowerCase();
    return words.filter((word) => hay.includes(word)).length;
  }
}
