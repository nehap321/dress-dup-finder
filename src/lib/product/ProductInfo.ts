export type Money = {
  amount: number;
  currency: string | null;
};

export type ProductColor = {
  name: string;
  images: string[];
};

export type ProductInfo = {
  sourceUrl: string;
  title: string;
  brand: string | null;
  /** Set when the page has one color, or after she picks one. */
  color: string | null;
  /** Every color the product page lists. Empty when the page doesn't name a color. */
  colors: ProductColor[];
  images: string[];
  price: Money | null;
  priceVaries: boolean;
};
