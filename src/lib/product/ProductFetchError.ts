export class ProductFetchError extends Error {
  constructor(
    readonly code: "invalid_url" | "fetch_failed" | "not_a_product",
    message: string,
  ) {
    super(message);
    this.name = "ProductFetchError";
  }
}
