export class PhotoStem {
  static of(value: string): string {
    try {
      const url = new URL(value, "https://example.com");
      const file = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      return file.replace(/\.(?:jpe?g|png|webp|gif|avif)$/i, "").toLowerCase();
    } catch {
      return "";
    }
  }

  static same(left: string, right: string): boolean {
    const a = PhotoStem.of(left);
    const b = PhotoStem.of(right);
    if (a.length < 8 || b.length < 8) return false;
    return a === b || a.includes(b) || b.includes(a);
  }
}
