import type { ProductInfo } from "./ProductInfo";

export class ProductColors {
  /** Narrow the dress to one color from the product page. Ask when several colors exist and none is chosen. */
  static apply(product: ProductInfo, selected: string | null): { ready: true; product: ProductInfo } | { ready: false } {
    if (product.colors.length <= 1) {
      const only = product.colors[0];
      return {
        ready: true,
        product: {
          ...product,
          color: only?.name ?? product.color,
          images: only && only.images.length > 0 ? only.images : product.images,
        },
      };
    }
    const wanted = (selected ?? "").trim().toLowerCase();
    const match = product.colors.find((color) => color.name.toLowerCase() === wanted);
    if (!match) return { ready: false };
    return {
      ready: true,
      product: {
        ...product,
        color: match.name,
        images: match.images.length > 0 ? match.images : product.images,
      },
    };
  }
}
