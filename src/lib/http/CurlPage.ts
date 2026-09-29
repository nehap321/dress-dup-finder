import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { AppConfig } from "../config/AppConfig";
import { AddressPolicy } from "./AddressPolicy";
import type { FetchedPage } from "./PageTransport";
import { RateLimiter } from "./RateLimiter";
import { SafeFetchError } from "./SafeFetchError";

const execFileAsync = promisify(execFile);

export class CurlPage {
  static async get(rawUrl: string, cookieJar?: string): Promise<FetchedPage> {
    const current = AddressPolicy.parse(rawUrl);
    await AddressPolicy.assertPublicDns(current.hostname);
    await RateLimiter.pace(current.hostname);
    const dir = await mkdtemp(join(tmpdir(), "dressdup-"));
    const bodyPath = join(dir, "body");
    try {
      const { stdout } = await execFileAsync(
        "curl",
        [
          "-sS",
          "-L",
          "--proto",
          "=https",
          "--max-redirs",
          "3",
          "--max-time",
          String(Math.max(1, Math.ceil(AppConfig.fetchTimeoutMs() / 1000))),
          "--max-filesize",
          String(AppConfig.maxBytes()),
          "-A",
          AppConfig.userAgent(),
          "-H",
          "Accept: text/html,application/json;q=0.9,*/*;q=0.8",
          "-H",
          "Accept-Language: en-US,en;q=0.9",
          ...(cookieJar ? ["-c", cookieJar, "-b", cookieJar] : []),
          "-o",
          bodyPath,
          "-w",
          "%{http_code} %{url_effective}",
          current.toString(),
        ],
        { timeout: AppConfig.fetchTimeoutMs() + 2000, maxBuffer: 16_000 },
      );
      const [statusText, ...rest] = stdout.trim().split(" ");
      const status = Number(statusText);
      const finalUrl = rest.join(" ");
      if (finalUrl) AddressPolicy.rejectIfDisallowed(new URL(finalUrl));
      const body = await readFile(bodyPath, "utf8");
      if (body.length > AppConfig.maxBytes()) {
        throw new SafeFetchError("That page is too large to read.", "fetch_failed", status);
      }
      return {
        url: finalUrl || current.toString(),
        status: Number.isFinite(status) ? status : 0,
        body,
        contentType: "text/html",
      };
    } catch (error) {
      if (error instanceof SafeFetchError) throw error;
      throw new SafeFetchError("Couldn't reach that site.", "fetch_failed");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
