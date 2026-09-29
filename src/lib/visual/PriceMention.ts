import type { Money } from "../product/ProductInfo";

export class PriceMention {
  static fromTitle(title: string): Money | null {
    const dollar = title.match(/(?:usd\s*)?\$\s*(\d{1,5}(?:\.\d{1,2})?)/i) ?? title.match(/(\d{1,5}(?:\.\d{1,2})?)\s*usd/i);
    if (dollar?.[1]) return { amount: Number(dollar[1]), currency: "USD" };
    const pound = title.match(/£\s*(\d{1,5}(?:\.\d{1,2})?)/);
    if (pound?.[1]) return { amount: Number(pound[1]), currency: "GBP" };
    const euro = title.match(/€\s*(\d{1,5}(?:\.\d{1,2})?)/);
    if (euro?.[1]) return { amount: Number(euro[1]), currency: "EUR" };
    return null;
  }
}
