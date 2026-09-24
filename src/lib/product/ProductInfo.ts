export type Money = {
  amount: number;
  currency: string | null;
};

export type ProductInfo = {
  sourceUrl: string;
  title: string;
  brand: string | null;
  color: string | null;
  images: string[];
  price: Money | null;
  priceVaries: boolean;
};
