export class ProductPaths {
  static shopifyJsUrl(pageUrl: URL): string | null {
    const parts = pageUrl.pathname.split("/").filter(Boolean);
    const index = parts.lastIndexOf("products");
    const handle = index >= 0 ? parts[index + 1] : undefined;
    if (!handle || handle.endsWith(".js") || handle.endsWith(".json")) return null;
    return `${pageUrl.origin}/products/${encodeURIComponent(handle)}.js`;
  }
}
