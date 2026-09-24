export class SafeFetchError extends Error {
  readonly status?: number;

  constructor(
    message: string,
    readonly code: "invalid_url" | "fetch_failed",
    status?: number,
  ) {
    super(message);
    this.name = "SafeFetchError";
    this.status = status;
  }
}
