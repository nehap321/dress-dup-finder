import { MatchService } from "@/lib/match/MatchService";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_input", message: "Send the product URL as JSON." } },
      { status: 400 },
    );
  }
  const result = await MatchService.match(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
