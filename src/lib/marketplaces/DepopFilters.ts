const COLOUR_WORDS: Record<string, string> = {
  black: "black",
  white: "white",
  gray: "grey",
  grey: "grey",
  charcoal: "grey",
  blue: "blue",
  navy: "navy",
  red: "red",
  burgundy: "burgundy",
  wine: "burgundy",
  pink: "pink",
  blush: "pink",
  purple: "purple",
  lilac: "purple",
  lavender: "purple",
  green: "green",
  olive: "green",
  hunter: "green",
  yellow: "yellow",
  orange: "orange",
  rust: "orange",
  brown: "brown",
  tan: "tan",
  nude: "tan",
  camel: "tan",
  beige: "cream",
  cream: "cream",
  ivory: "cream",
  khaki: "khaki",
  gold: "gold",
  silver: "silver",
  multi: "multi",
  multicolor: "multi",
  multicolour: "multi",
};

export class DepopFilters {
  static currencyForCountry(country: string): string | null {
    const currencies: Record<string, string> = {
      us: "USD",
      uk: "GBP",
      au: "AUD",
      eu: "EUR",
      de: "EUR",
      fr: "EUR",
      it: "EUR",
    };
    return currencies[country] ?? null;
  }

  static coloursParam(color: string | null): string | null {
    if (!color) return null;
    const found: string[] = [];
    const tokens = color.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    for (const token of tokens) {
      const mapped = COLOUR_WORDS[token];
      if (mapped && !found.includes(mapped)) found.push(mapped);
    }
    return found.length > 0 ? found.join(",") : null;
  }

  static sizesParam(size: string | null): string | null {
    if (!size) return null;
    const compact = size.trim().replace(/\s+/g, " ");
    if (/^one[\s-]*size$/i.test(compact)) return "One Size";
    const words: Record<string, string> = {
      "x-small": "US-XS",
      xsmall: "US-XS",
      small: "US-S",
      medium: "US-M",
      large: "US-L",
      "x-large": "US-XL",
      xlarge: "US-XL",
    };
    const word = words[compact.toLowerCase()];
    if (word) return word;
    const region = compact.match(/^(us|uk|eu|au)[\s-]*(\d{1,2}|xxxs|xxs|xs|s|m|l|xl|xxl|xxxl)$/i);
    if (region?.[1] && region[2]) return `${region[1].toUpperCase()}-${region[2].toUpperCase()}`;
    if (/^(xxxs|xxs|xs|s|m|l|xl|xxl|xxxl)$/i.test(compact)) return `US-${compact.toUpperCase()}`;
    if (/^\d{1,2}$/.test(compact)) return `US-${compact}`;
    return null;
  }
}
