import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { SafeFetchError } from "./SafeFetchError";

export class AddressPolicy {
  static parse(raw: string): URL {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > 2000) {
      throw new SafeFetchError("Paste a public product link.", "invalid_url");
    }
    const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let url: URL;
    try {
      url = new URL(withProtocol);
    } catch {
      throw new SafeFetchError("That doesn't look like a valid link.", "invalid_url");
    }
    AddressPolicy.rejectIfDisallowed(url);
    return url;
  }

  static rejectIfDisallowed(url: URL): void {
    if (url.username || url.password) {
      throw new SafeFetchError("Links with a username or password aren't allowed.", "invalid_url");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new SafeFetchError("Paste a public http or https product link.", "invalid_url");
    }
    const host = AddressPolicy.bareHost(url.hostname);
    if (
      !host ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal")
    ) {
      throw new SafeFetchError(
        "That link points at a private address, so it can't be fetched.",
        "invalid_url",
      );
    }
    if (isIP(host) && AddressPolicy.isPrivateIp(host)) {
      throw new SafeFetchError(
        "That link points at a private address, so it can't be fetched.",
        "invalid_url",
      );
    }
  }

  static async assertPublicDns(hostname: string): Promise<void> {
    const host = AddressPolicy.bareHost(hostname);
    if (isIP(host)) {
      if (AddressPolicy.isPrivateIp(host)) {
        throw new SafeFetchError(
          "That link points at a private address, so it can't be fetched.",
          "invalid_url",
        );
      }
      return;
    }
    let records: { address: string }[];
    try {
      records = await lookup(host, { all: true, verbatim: true });
    } catch {
      throw new SafeFetchError("Couldn't reach that site.", "fetch_failed");
    }
    if (records.length === 0 || records.some((record) => AddressPolicy.isPrivateIp(record.address))) {
      throw new SafeFetchError(
        "That link points at a private address, so it can't be fetched.",
        "invalid_url",
      );
    }
  }

  static isPrivateIp(ip: string): boolean {
    const normalized = (ip.toLowerCase().split("%")[0] ?? ip).trim();
    if (normalized.startsWith("::ffff:")) {
      return AddressPolicy.isPrivateIp(normalized.slice("::ffff:".length));
    }
    if (isIP(normalized) === 4) {
      const parts = normalized.split(".").map(Number);
      const a = parts[0] ?? 0;
      const b = parts[1] ?? 0;
      if (a === 0 || a === 10 || a === 127) return true;
      if (a === 169 && b === 254) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 100 && b >= 64 && b <= 127) return true;
      if (a >= 224) return true;
      return false;
    }
    if (normalized === "::1" || normalized === "::") return true;
    if (/^f[cd]/.test(normalized) || normalized.startsWith("fe80") || normalized.startsWith("fec0")) {
      return true;
    }
    return false;
  }

  private static bareHost(hostname: string): string {
    return hostname.replace(/^\[|\]$/g, "").toLowerCase();
  }
}
